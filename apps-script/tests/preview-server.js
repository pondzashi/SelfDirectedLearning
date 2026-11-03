// เซิร์ฟเวอร์ทดลองหน้าเว็บบนเครื่อง (ไม่ต้อง deploy): รัน Code.gs บน Sheet จำลอง + ข้อสอบชุดเล็ก
// ใช้: node apps-script/tests/preview-server.js  แล้วเปิด http://localhost:8787/
// /warp?min=5 = เลื่อนเวลา server ไปข้างหน้า 5 นาที (ทดสอบหมดเวลา)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createEnv, ROOT } = require('./harness');

const PORT = Number(process.env.PORT) || 8787;
const e = createEnv();
e.importCsv(path.join(ROOT, '..', 'data', process.env.CSV || 'questions_sample.csv'));
if (!process.env.CSV) {
  e.setSetting('blueprint_english', 'Vocabulary=1;Grammar=1;Reading=2;Error Identification=1');
  e.setSetting('blueprint_thai_social', 'อักขรวิธี=1;จับใจความ=1;ความรู้ทั่วไปทางศิลปะ=1;ประวัติศาสตร์ศิลป์=1;ข่าวปัจจุบัน=1');
  e.setSetting('blueprint_art', 'ทฤษฎีสี=2;องค์ประกอบภาพ=1;ทัศนธาตุและหลักการออกแบบ=1;โลโก้และไอคอน=1');
  e.setSetting('duration_min_english', 3);
  e.setSetting('duration_min_thai_social', 3);
  e.setSetting('duration_min_art', 3);
}
e.setSetting('owner_email', 'owner@example.com');
// รูปประกอบ: จำลอง Drive ด้วยไฟล์ใน data/images (image_url = drive:<ชื่อไฟล์>)
const IMG_DIR = path.join(ROOT, '..', 'data', 'images');
if (fs.existsSync(IMG_DIR)) {
  e.setSetting('images_folder_id', 'LOCAL_IMAGES');
  fs.readdirSync(IMG_DIR).filter((f) => /\.(svg|png|jpe?g)$/i.test(f)).forEach((f, i) => {
    const type = f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.png') ? 'image/png' : 'image/jpeg';
    e.env.files['IMG' + i] = { name: f, folder: 'LOCAL_IMAGES', type, bytes: fs.readFileSync(path.join(IMG_DIR, f)) };
  });
}
e.clock.t = Date.now();
setInterval(() => { e.clock.t += 1000; }, 1000); // นาฬิกา server เดินตามจริง (+ /warp)

const shim = `<script>
(function(){
  function runner(ok, bad){
    return new Proxy({}, { get: function(_, k){
      if (k === 'withSuccessHandler') return function(f){ return runner(f, bad); };
      if (k === 'withFailureHandler') return function(f){ return runner(ok, f); };
      return function(){ var args = Array.prototype.slice.call(arguments);
        fetch('/rpc', { method: 'POST', body: JSON.stringify({ fn: k, args: args }) }).then(function(r){ return r.json(); })
          .then(function(j){ if (j.error) { bad && bad(new Error(j.error)); } else { ok && ok(j.result); } }, function(err){ bad && bad(err); });
      };
    }});
  }
  var q = {}; new URLSearchParams(location.search).forEach(function(v, k){ q[k] = v; });
  window.google = { script: { run: runner(null, null), url: { getLocation: function(cb){ setTimeout(function(){ cb({ parameter: q, hash: '' }); }, 0); } } } };
})();
</script>`;

function page(file, vars) {
  let html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  html = html.replace(/<\?!= include\('(\w+)'\) \?>/g, (_, n) => fs.readFileSync(path.join(ROOT, n + '.html'), 'utf8'));
  html = html.replace(/<\?= (\w+) \?>/g, (_, n) => String(vars[n] == null ? '' : vars[n]).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'));
  if (/<\?/.test(html)) throw new Error('scriptlet ที่ไม่รู้จักใน ' + file);
  return html.replace('<head>', '<head>' + shim);
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (req.method === 'POST' && u.pathname === '/rpc') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const { fn, args } = JSON.parse(body);
        let out;
        try { if (!/^(api_|dash_)/.test(fn)) throw new Error('เรียกไม่ได้: ' + fn); out = { result: e.call(fn, ...args) }; }
        catch (err) { out = { error: err.message }; console.log('RPC error', fn, err.message); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      });
      return;
    }
    if (u.pathname === '/warp') {
      e.clock.t += Number(u.searchParams.get('min') || 1) * 60000;
      res.end('ok, server time +' + u.searchParams.get('min') + ' min');
      return;
    }
    if (u.pathname === '/images') {
      const files = fs.existsSync(IMG_DIR) ? fs.readdirSync(IMG_DIR).filter((f) => f.endsWith('.svg')) : [];
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<body style="background:#ddd;font-family:sans-serif">' + files.map((f) => `<div style="display:inline-block;margin:6px;background:#fff;padding:4px"><div>${f}</div><img style="max-width:280px" src="data:image/svg+xml;base64,${fs.readFileSync(path.join(IMG_DIR, f)).toString('base64')}"></div>`).join('') + '</body>');
      return;
    }
    if (u.pathname === '/newlink') {
      const r = e.call('dash_createLinks', '', { mode: u.searchParams.get('mode') || '', subject: u.searchParams.get('subject') || '' });
      const tok = r.urls[0].split('t=')[1];
      res.writeHead(302, { Location: '/?t=' + tok }); res.end();
      return;
    }
    let html;
    if (u.searchParams.get('page') === 'dashboard') html = page('Dashboard.html', { title: 'Pre-test (ทดลอง)' });
    else if (u.searchParams.get('t')) html = page('Exam.html', { title: 'Pre-test (ทดลอง)', token: u.searchParams.get('t') });
    else {
      html = '<meta charset="utf-8"><body style="font-family:sans-serif;padding:20px"><h2>ทดลองระบบบนเครื่อง</h2><ul>' +
        '<li><a href="/newlink">ลิงก์สอบใหม่ (ลูกเลือกโหมดเอง)</a></li><li><a href="/newlink?mode=mock_full">Mock เต็มชุด</a></li>' +
        '<li><a href="/?page=dashboard">Dashboard</a></li><li><a href="/warp?min=1">เลื่อนเวลา +1 นาที</a></li></ul>' +
        '<p>วิชาละ 5 ข้อ 3 นาที (ข้อสอบตัวอย่าง)</p></body>';
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) { res.writeHead(500); res.end(String(err.stack)); }
}).listen(PORT, () => console.log('preview http://localhost:' + PORT));
