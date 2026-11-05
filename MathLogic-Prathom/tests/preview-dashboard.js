/**
 * พรีวิวหน้า Dashboard ด้วยข้อมูลจำลอง (ไม่ใช้ Google):
 *   DASH_OUT=bundle.json node tests/gas-integration.js     # สร้างข้อมูลจำลอง 5 สัปดาห์
 *   node tests/preview-dashboard.js bundle.json [port]      # เปิด http://localhost:8766/ (PIN = 4321)
 */
const fs = require('fs'), path = require('path'), http = require('http');
const bundle = fs.readFileSync(process.argv[2], 'utf8');
const port = +process.argv[3] || 8766;
const html = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Dashboard.html'), 'utf8');
const MOCK = `<script>
window.google = { script: { run: (function () {
  var B = ${bundle};
  function mk(ok, fail) { return new Proxy({}, { get: function (_, name) {
    if (name === 'withSuccessHandler') return function (f) { return mk(f, fail); };
    if (name === 'withFailureHandler') return function (f) { return mk(ok, f); };
    return function (pin, arg) { setTimeout(function () {
      if (name === 'dash_check') ok(pin === '4321' ? { ok: true } : (pin ? { ok: false, reason: 'wrong', left: 3 } : { ok: false, reason: 'need' }));
      else if (pin !== '4321') fail({ message: 'ไม่มีสิทธิ์เข้าถึง' });
      else if (name === 'dash_getBundle') ok(B);
      else if (name === 'dash_getSession') ok({ date: pin === arg ? '' : arg, total: 31, wrong: [
        { section: 'คิดเลขเร็ว', cat: 'คูณ', label: 'คูณ ขั้น 4 · 2 หลัก × 1 หลัก มีทด', q: '47 × 6 =', errType: 'ทดผิด/ลืมทด', tries: 2, revealed: false, review: false },
        { section: 'การสังเกต', cat: 'การสังเกต', label: 'การสังเกต · แบบ O13', q: 'น้องต้นคิดบวก 478 + 365 ไว้ดังนี้ ...', errType: 'สังเกตไม่ครบ', tries: 3, revealed: true, review: true }] });
    }, 80); };
  } }); }
  return mk(function () {}, function () {});
})() } };
</script>`;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html.replace('<div id="app"', () => MOCK + '<div id="app"'));
}).listen(port, () => console.log('dashboard preview on http://localhost:' + port));
