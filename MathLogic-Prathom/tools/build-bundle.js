// รวมไฟล์ .gs ทั้งหมดเป็นไฟล์เดียว (dist/Code.gs) เพื่อวางครั้งเดียวใน Apps Script: node tools/build-bundle.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = path.join(__dirname, '..', 'apps-script'), out = path.join(__dirname, '..', 'dist');
const order = ['Core', 'Generators', 'Templates', 'BankSeed', 'Curriculum', 'SetBuilder', 'SelfTest', 'DashLogic', 'Store', 'Session', 'Reports', 'Dashboard', 'Code'];
let text = '/** ฝึกคณิต ป.4 — ไฟล์รวมทุกสคริปต์ (สร้างโดย tools/build-bundle.js) วางทับ Code.gs ได้ทั้งไฟล์ */\n';
for (const f of order) text += '\n// ======================= ' + f + '.gs =======================\n' + fs.readFileSync(path.join(src, f + '.gs'), 'utf8').replace(/\r\n/g, '\n');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'Code.gs'), text);
fs.copyFileSync(path.join(src, 'Index.html'), path.join(out, 'Index.html'));
fs.copyFileSync(path.join(src, 'Dashboard.html'), path.join(out, 'Dashboard.html'));
fs.copyFileSync(path.join(src, 'appsscript.json'), path.join(out, 'appsscript.json'));
const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, String, Number, RegExp, Error });
vm.runInContext(text.replace(/function (setup|doGet|onOpen)\b/g, 'function $1'), ctx);
console.log('bundle OK:', Buffer.byteLength(text), 'bytes; steps', vm.runInContext('STEPS.length', ctx), 'templates', vm.runInContext('TEMPLATES.length', ctx));
