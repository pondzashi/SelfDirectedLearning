// จำลองบริการ Google (Sheet, Lock, Cache, ฯลฯ) ในหน่วยความจำ เพื่อรัน Code.gs จริงทั้งชุดด้วย Node
// ไม่ใช่ของแทนการทดสอบบน Apps Script จริง (README ขั้นตอนทดสอบหลัง deploy) แต่จับบั๊กตรรกะได้เกือบทั้งหมด
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

class FakeSheet {
  // ขนาดเริ่มต้นเท่าชีตจริงจาก insertSheet() (1000 × 26) และ getRange เกินขอบ = error เหมือนของจริง
  constructor(name) { this.name = name; this.data = []; this.maxRows = 1000; this.maxCols = 26; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return this.data.reduce((m, r) => Math.max(m, r.length), 0); }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  insertRowsAfter(after, n) { this.maxRows += n; }
  insertColumnsAfter(after, n) { this.maxCols += n; }
  setFrozenRows() {}
  getRange(r, c, nr = 1, nc = 1) {
    const sh = this;
    if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error(`ช่วงไม่ถูกต้อง ${r},${c},${nr},${nc}`);
    if (r + nr - 1 > sh.maxRows || c + nc - 1 > sh.maxCols) {
      throw new Error(`The coordinates of the range are outside the dimensions of the sheet (${sh.name}: ${r + nr - 1}x${c + nc - 1} > ${sh.maxRows}x${sh.maxCols})`);
    }
    return {
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (sh.data[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); }
        return out;
      },
      setValues(vals) {
        if (vals.length !== nr || vals[0].length !== nc) throw new Error(`setValues ขนาดไม่ตรง ${vals.length}x${vals[0].length} vs ${nr}x${nc}`);
        for (let i = 0; i < nr; i++) { while (sh.data.length < r + i) sh.data.push([]); const row = sh.data[r - 1 + i]; for (let j = 0; j < nc; j++) row[c - 1 + j] = vals[i][j]; }
        sh.writes = (sh.writes || 0) + 1;
        return this;
      },
      setValue(v) { return this.setValues([[v]]); },
      setNumberFormat() { return this; },
      setFontWeight() { return this; }
    };
  }
}

class FakeSS {
  constructor() { this.sheets = {}; }
  getId() { return 'FAKE_SHEET_ID'; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new FakeSheet(n)); }
}

function createEnv(opts = {}) {
  const clock = { t: Date.UTC(2026, 10, 2, 3, 0, 0) };
  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(clock.t); else super(...a); }
    static now() { return clock.t; }
  }
  const ss = new FakeSS();
  const props = { SHEET_ID: 'FAKE_SHEET_ID' };
  const cacheStore = {};
  const cache = {
    get: (k) => (k in cacheStore ? cacheStore[k] : null),
    put: (k, v) => { cacheStore[k] = String(v); },
    putAll: (o) => { Object.keys(o).forEach((k) => { cacheStore[k] = String(o[k]); }); },
    getAll: (ks) => { const o = {}; ks.forEach((k) => { if (k in cacheStore) o[k] = cacheStore[k]; }); return o; },
    removeAll: (ks) => ks.forEach((k) => delete cacheStore[k])
  };
  const env = { activeEmail: 'owner@example.com', locks: 0, triggers: [] };
  const sandbox = {
    console, Math, JSON, Object, Array, String, Number, Boolean, Error, RegExp, isNaN, parseInt, parseFloat,
    Date: FakeDate,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss, openById: () => ss,
      getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }), alert: (m) => { env.lastAlert = m; } })
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => cache },
    LockService: { getScriptLock: () => ({ waitLock() { env.locks++; }, releaseLock() { env.locks--; } }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d) => new Date(d).toISOString().slice(0, 10),
      base64Encode: (x) => Buffer.from(x).toString('base64'),
      computeDigest: (a, s) => crypto.createHash('md5').update(s).digest(),
      DigestAlgorithm: { MD5: 'MD5' }
    },
    Session: { getActiveUser: () => ({ getEmail: () => env.activeEmail }), getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
    ScriptApp: {
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/FAKE/exec' }),
      getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() {} }) }) }), deleteTrigger() {}
    },
    HtmlService: {},
    // Drive จำลอง: env.files = { fileId: {name, folder, type, bytes} }
    DriveApp: {
      getFileById: (id) => { const f = env.files[id]; if (!f) throw new Error('ไม่พบไฟล์ ' + id); return fakeFile(f); },
      getFolderById: (fid) => ({
        getFilesByName: (name) => {
          const list = Object.values(env.files).filter((f) => f.folder === fid && f.name === name);
          let i = 0;
          return { hasNext: () => i < list.length, next: () => fakeFile(list[i++]) };
        }
      })
    }
  };
  env.files = {};
  function fakeFile(f) { return { getBlob: () => ({ getContentType: () => f.type, getBytes: () => Buffer.from(f.bytes) }) }; }
  const ctx = vm.createContext(sandbox);
  ['Logic.gs', 'Setup.gs', 'Db.gs', 'Code.gs'].concat(fs.readdirSync(ROOT).filter((f) => /^Bank\d+\.gs$/.test(f)).sort()).forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  });
  const run = (code) => vm.runInContext(code, ctx);

  // เตรียมแท็บและค่าเริ่มต้นเหมือนเมนู "เตรียมระบบ"
  ctx.setupSheets_(ss);

  function importCsv(file) {
    const rows = parseCsv(fs.readFileSync(file, 'utf8'));
    const header = rows[0];
    const qs = ss.getSheetByName('Questions');
    const fd = header.indexOf('fact_date');
    const body = rows.slice(1).filter((r) => r.length > 1).map((r) => r.map((v, i) => (i === fd && /^\d{4}-\d\d-\d\d$/.test(v) ? new FakeDate(v + 'T00:00:00Z') : v))); // Sheets แปลงวันที่ให้เอง
    qs.data = [header].concat(body);
    qs.maxRows = Math.max(qs.maxRows, qs.data.length); // การนำเข้า CSV ของ Sheets ขยายแถวให้เอง
    run('clearQuestionCache_()');
  }

  function setSetting(key, value) {
    const sh = ss.getSheetByName('Settings');
    const row = sh.data.findIndex((r, i) => i > 0 && r[0] === key);
    if (row < 0) sh.data.push([key, value, '']); else sh.data[row][1] = value;
    run('__settings = null');
  }

  const table = (name) => {
    const sh = ss.getSheetByName(name);
    const h = sh.data[0] || [];
    return sh.data.slice(1).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] === undefined ? '' : r[i]])));
  };

  const call = (fn, ...args) => {
    sandbox.__args = args;
    const r = run(`${fn}.apply(null, __args)`);
    return r === undefined ? r : JSON.parse(JSON.stringify(r)); // เหมือน google.script.run: ส่งได้เฉพาะ JSON (Date จะกลายเป็นสตริง)
  };

  // เหมือน google.script.run: ส่งกลับได้เฉพาะค่าที่ serialize ได้ (ตรวจว่าไม่มี Date หลุดไป)
  const callStrict = (fn, ...args) => {
    sandbox.__args = args;
    const r = run(`${fn}.apply(null, __args)`);
    const hasDate = (v) => v instanceof Date || (v && typeof v === 'object' && Object.values(v).some(hasDate));
    if (hasDate(r)) throw new Error(`${fn} คืนค่า Date (google.script.run ไม่รองรับ)`);
    return r === undefined ? r : JSON.parse(JSON.stringify(r));
  };

  return { ctx, clock, ss, env, run, importCsv, setSetting, table, call: callStrict, callLoose: call, cacheStore, props, sandbox };
}

module.exports = { createEnv, parseCsv, ROOT };
