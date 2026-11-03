/**
 * Templates.gs — แม่แบบโจทย์ 68 แบบ: โจทย์ปัญหา 22 / การสังเกต 24 / คิดวิเคราะห์ 22 (รวมไว้ในไฟล์เดียว เพราะต้องประกาศฟังก์ชัน T() ก่อนใช้)
 * สุ่มชื่อ สิ่งของ ตัวเลขใหม่ทุกครั้ง ระดับความยาก t = 1..4
 * ไม่เรียก API ของ Google (ทดสอบด้วย Node ได้)
 *
 * item = {key, cat, tpl, q, ans, type, choices?, data?, unit?, traps?, explain, tier}
 */
var TEMPLATES = [];
var TPL_BY_ID = {};
function T(id, cat, grp, min, max, fn) {
  var t = { id: id, cat: cat, grp: grp, min: min, max: max, fn: fn };
  TEMPLATES.push(t); TPL_BY_ID[id] = t;
}
function buildTemplate(id, tier) {
  var t = TPL_BY_ID[id];
  tier = Math.max(t.min, Math.min(t.max, tier));
  var it = t.fn(tier);
  it.cat = t.cat; it.tpl = id; it.key = 'TPL:' + id; it.tag = id; it.tier = tier;
  it.type = it.type || 'int';
  it.ans = String(it.ans);
  if (it.traps) delete it.traps[it.ans];
  if (!it.explain) it.explain = 'อ่านโจทย์ช้า ๆ ขีดเส้นใต้ข้อมูลที่ต้องใช้ แล้วลองคิดทีละขั้น';
  return it;
}
/** เลือกแม่แบบที่รองรับระดับ tier ในหมวด cat (กลุ่ม grp ถ้าระบุ) โดยเลี่ยง exclude */
function pickTemplate(cat, grp, tier, exclude) {
  var all = TEMPLATES.filter(function (t) { return t.cat === cat && (!grp || t.grp === grp) && t.min <= tier && tier <= t.max; });
  var fresh = all.filter(function (t) { return !exclude || !exclude[t.id]; });
  return pick(fresh.length ? fresh : all).id;
}

var PEOPLE = ['ต้น', 'ฟ้า', 'นุ่น', 'บอส', 'มะลิ', 'ภูมิ', 'แพรว', 'กวาง', 'ปลื้ม', 'น้ำใส', 'เจ', 'ใบบัว', 'ก้อง', 'ขวัญ', 'พลอย', 'ธีร์'];
var THINGS = [['ดินสอ', 'แท่ง', 5, 12], ['สมุด', 'เล่ม', 10, 35], ['ขนมปัง', 'ก้อน', 8, 25], ['ไอศกรีม', 'แท่ง', 10, 30],
  ['ปากกา', 'ด้าม', 6, 25], ['ยางลบ', 'ก้อน', 5, 15], ['ลูกโป่ง', 'ลูก', 3, 10], ['สติกเกอร์', 'แผ่น', 2, 8], ['ไข่ไก่', 'ฟอง', 4, 6], ['ลูกอม', 'ถุง', 6, 20]];
function two() { var a = pick(PEOPLE), b = retry(function () { return pick(PEOPLE); }, function (x) { return x !== a; }); return [a, b]; }
/** ประโยคที่ไม่เกี่ยวข้อง (ข้อมูลหลอก) ใส่ตั้งแต่ระดับ 2 */
function distract(t) {
  if (t < 2 || !chance(0.65)) return '';
  return pick(['โรงเรียนนี้มีนักเรียน ' + ri(300, 900) + ' คน', 'วันนั้นเป็นวันเกิดคุณยาย อายุ ' + ri(60, 85) + ' ปี',
    'บ้านอยู่ชั้น ' + ri(2, 9) + ' ของอาคาร', 'ฝนตกตั้งแต่เวลา ' + ri(1, 5) + ' โมงเย็น', 'ร้านนี้เปิดมาแล้ว ' + ri(5, 20) + ' ปี']);
}
function WP(parts) { return parts.filter(function (x) { return x; }).join(' '); }

/* ======================= โจทย์ปัญหา (22) ======================= */
T('W01', 'word', 'w', 1, 4, function (t) {
  var p = pick(PEOPLE), a = pick(THINGS), k = ri(2, 3 + t), pr = ri(a[2], a[3]), total = pr * k, q;
  if (t >= 3) {
    var b = pick(THINGS.filter(function (x) { return x !== a; })), k2 = ri(2, 5), pr2 = ri(b[2], b[3]);
    total += pr2 * k2;
    q = p + 'ซื้อ' + a[0] + a[1] + 'ละ ' + pr + ' บาท จำนวน ' + k + ' ' + a[1] + ' และซื้อ' + b[0] + b[1] + 'ละ ' + pr2 + ' บาท จำนวน ' + k2 + ' ' + b[1];
  } else q = p + 'ซื้อ' + a[0] + a[1] + 'ละ ' + pr + ' บาท จำนวน ' + k + ' ' + a[1];
  var pay = (Math.floor(total / 50) + 1) * 50, tp = {}; tp[total] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([q, distract(t), 'จ่ายเงิน ' + pay + ' บาท จะได้เงินทอนกี่บาท']), ans: pay - total, unit: 'บาท', traps: tp, explain: 'หาราคารวมก่อน แล้วนำเงินที่จ่ายลบราคารวม = ' + pay + ' − ' + total };
});
T('W02', 'word', 'w', 1, 4, function (t) {
  var n = two(), x = ri(8 * t, 20 * t), y = ri(3, 10) * t, tp = {}; tp[x + y] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([n[0] + 'มีสติกเกอร์ ' + x + ' แผ่น ' + n[1] + 'มีมากกว่า' + n[0] + ' ' + y + ' แผ่น', distract(t), 'ทั้งสองคนมีสติกเกอร์รวมกันกี่แผ่น']), ans: 2 * x + y, unit: 'แผ่น', traps: tp, explain: n[1] + 'มี ' + x + ' + ' + y + ' = ' + (x + y) + ' แผ่น แล้วรวมกับของ' + n[0] };
});
T('W03', 'word', 'w', 1, 4, function (t) {
  var m = ri(4, 9), bags = ri(3, 5 + t), r = ri(1, m - 1), Tt = m * bags + r, th = pick(THINGS), tp = {}; tp[bags] = 'ลืมเศษที่เหลือ';
  return { q: WP(['มี' + th[0] + ' ' + Tt + ' ' + th[1] + ' ใส่ถุงได้ถุงละ ' + m + ' ' + th[1], distract(t), 'ต้องใช้ถุงอย่างน้อยกี่ใบจึงใส่ได้หมด']), ans: bags + 1, unit: 'ใบ', traps: tp, explain: Tt + ' ÷ ' + m + ' ได้ ' + bags + ' เศษ ' + r + ' ของที่เหลือต้องใช้ถุงเพิ่มอีก 1 ใบ' };
});
T('W04', 'word', 'w', 1, 4, function (t) {
  var a = ri(3, 8 + 3 * t), b = ri(3, 8 + 3 * t), p = pick(PEOPLE), tp = {}; tp[a + b] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([p + 'ปั่นจักรยานจากบ้านไปตลาด ' + a + ' กิโลเมตร แล้วไปต่อที่โรงเรียนอีก ' + b + ' กิโลเมตร', distract(t), 'ถ้าปั่นกลับบ้านทางเดิม ตลอดการไปและกลับ' + p + 'ปั่นรวมกี่กิโลเมตร']), ans: 2 * (a + b), unit: 'กิโลเมตร', traps: tp, explain: 'ขาไป ' + a + ' + ' + b + ' = ' + (a + b) + ' กม. ขากลับเท่ากัน จึงคูณ 2' };
});
T('W05', 'word', 'w', 1, 4, function (t) {
  var k = ri(3, 6), u = ri(3, 9) + t, P = k * u, m = ri(5, 12 + 2 * t), th = pick(THINGS), tp = {}; tp[P * m] = 'ไม่ได้หาราคาต่อชิ้น';
  return { q: WP([th[0] + ' 1 แพ็คมี ' + k + ' ' + th[1] + ' ราคาแพ็คละ ' + P + ' บาท', distract(t), 'ถ้าซื้อ ' + m + ' ' + th[1] + ' ต้องจ่ายกี่บาท (ขายแยกชิ้นได้ในราคาเท่ากัน)']), ans: u * m, unit: 'บาท', traps: tp, explain: 'ราคาต่อชิ้น = ' + P + ' ÷ ' + k + ' = ' + u + ' บาท แล้วคูณ ' + m };
});
T('W06', 'word', 'w', 1, 4, function (t) {
  var h = ri(1, 1 + t), m = ri(10, 50), ad = ri(5, 20), p = pick(PEOPLE);
  return { q: WP([p + 'ดูภาพยนตร์ความยาว ' + h + ' ชั่วโมง ' + m + ' นาที', 'ก่อนฉายมีโฆษณา ' + ad + ' นาที', distract(t), 'รวมเวลาที่' + p + 'นั่งอยู่ในโรงภาพยนตร์กี่นาที']), ans: h * 60 + m + ad, unit: 'นาที', explain: '1 ชั่วโมง = 60 นาที แปลงเป็นนาทีทั้งหมดก่อนบวก' };
});
T('W07', 'word', 'w', 1, 4, function (t) {
  var w = ri(4, 10 + 2 * t), l = w + ri(2, 8), tp = {};
  if (t <= 2) { tp[w * l] = 'สับสนพื้นที่กับเส้นรอบรูป'; return { q: WP(['สนามรูปสี่เหลี่ยมผืนผ้ากว้าง ' + w + ' เมตร ยาว ' + l + ' เมตร', distract(t), 'ต้องใช้รั้วล้อมรอบสนามยาวกี่เมตร']), ans: 2 * (w + l), unit: 'เมตร', traps: tp, explain: 'เส้นรอบรูป = (กว้าง + ยาว) × 2' }; }
  if (t === 3) { tp[2 * (w + l)] = 'สับสนพื้นที่กับเส้นรอบรูป'; return { q: WP(['สวนรูปสี่เหลี่ยมผืนผ้ากว้าง ' + w + ' เมตร ยาว ' + l + ' เมตร', distract(t), 'สวนนี้มีพื้นที่กี่ตารางเมตร']), ans: w * l, unit: 'ตารางเมตร', traps: tp, explain: 'พื้นที่ = กว้าง × ยาว' }; }
  var c = ri(3, 9) * 10; tp[2 * (w + l)] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP(['ทำรั้วล้อมแปลงผักรูปสี่เหลี่ยมผืนผ้ากว้าง ' + w + ' เมตร ยาว ' + l + ' เมตร รั้วราคาเมตรละ ' + c + ' บาท', distract(t), 'ต้องจ่ายค่ารั้วกี่บาท']), ans: 2 * (w + l) * c, unit: 'บาท', traps: tp, explain: 'หาเส้นรอบรูปก่อน แล้วคูณราคาต่อเมตร' };
});
T('W08', 'word', 'w', 1, 4, function (t) {
  var b = ri(3, 8), a = retry(function () { return ri(1, b - 1); }, function (x) { return gcd(x, b) === 1; }), u = ri(3, 9) * t + 1, Tt = b * u, tp = {}; tp[u * a] = 'อ่านโจทย์ไม่ครบ';
  var p = pick(PEOPLE), th = pick(THINGS);
  return { q: WP([p + 'มี' + th[0] + ' ' + Tt + ' ' + th[1], 'ให้เพื่อนไป ' + F(a, b) + ' ของทั้งหมด', distract(t), p + 'เหลือ' + th[0] + 'กี่' + th[1]]), ans: Tt - u * a, unit: th[1], traps: tp, explain: Tt + ' ÷ ' + b + ' = ' + u + ' (1 ส่วน) ให้ไป ' + a + ' ส่วน แล้วหาที่เหลือ' };
});
T('W09', 'word', 'w', 1, 4, function (t) {
  var b = ri(5, 12), a = ri(5, b - 1), c = ri(1, a - 1), d = ri(1, b - 1);
  return { q: WP(['ในขวดมีน้ำ ' + F(a, b) + ' ลิตร ดื่มไป ' + F(c, b) + ' ลิตร แล้วเติมน้ำอีก ' + F(d, b) + ' ลิตร', distract(t), 'ตอนนี้ในขวดมีน้ำกี่ลิตร']), ans: fracStr(a - c + d, b), type: 'frac', unit: 'ลิตร', explain: 'ตัวส่วนเท่ากัน คิดเฉพาะตัวเศษ ' + a + ' − ' + c + ' + ' + d + ' แล้วทำให้เป็นอย่างต่ำ' };
});
T('W10', 'word', 'w', 1, 4, function (t) {
  var p = t >= 3 ? 2 : 1, A = p === 1 ? ri(21, 99) : ri(201, 999), B = ri(Math.floor(A / 5), A - 5), n = pick(PEOPLE);
  return { q: WP([n + 'มีริบบิ้นยาว ' + fmtScaled(A, p) + ' เมตร ตัดไปใช้ ' + fmtScaled(B, p) + ' เมตร', distract(t), 'เหลือริบบิ้นยาวกี่เมตร']), ans: trimDec(fmtScaled(A - B, p)), type: 'dec', unit: 'เมตร', explain: 'ตั้งจุดทศนิยมให้ตรงกันแล้วลบ' };
});
T('W11', 'word', 'w', 1, 4, function (t) {
  var A = retry(function () { return ri(12, 19 + 10 * t); }, function (x) { return x % 10; }), m = ri(3, 9), th = pick(['แอปเปิ้ล', 'ส้ม', 'มะม่วง', 'ลำไย']);
  return { q: WP([th + 'ถุงหนึ่งหนัก ' + fmtScaled(A, 1) + ' กิโลกรัม', distract(t), 'ซื้อ ' + m + ' ถุง รวมหนักกี่กิโลกรัม']), ans: trimDec(fmtScaled(A * m, 1)), type: 'dec', unit: 'กิโลกรัม', explain: 'คูณ ' + fmtScaled(A, 1) + ' × ' + m + ' (คูณเหมือนจำนวนเต็มแล้วใส่จุดทศนิยม 1 ตำแหน่ง)' };
});
T('W12', 'word', 'w', 1, 4, function (t) {
  var r = ri(4, 6 + t), c = ri(5, 9), s = r * c - ri(2, 9), tp = {}; tp[r * c] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP(['ห้องประชุมมีเก้าอี้ ' + r + ' แถว แถวละ ' + c + ' ตัว', distract(t), 'วันนี้มีคนมา ' + s + ' คน นั่งคนละ 1 ตัว เหลือเก้าอี้ว่างกี่ตัว']), ans: r * c - s, unit: 'ตัว', traps: tp, explain: 'เก้าอี้ทั้งหมด ' + r + ' × ' + c + ' = ' + (r * c) + ' แล้วลบจำนวนคน' };
});
T('W13', 'word', 'w', 1, 4, function (t) {
  var s = ri(20, 60) + 10 * t, wk = ri(3, 5 + t), h = ri(50, 200), G = h + s * wk, p = pick(PEOPLE);
  return { q: WP([p + 'อยากซื้อของราคา ' + commas(G) + ' บาท มีเงินอยู่แล้ว ' + h + ' บาท และออมเพิ่มสัปดาห์ละ ' + s + ' บาท', distract(t), 'ต้องออมอีกกี่สัปดาห์จึงจะพอซื้อ']), ans: wk, unit: 'สัปดาห์', explain: 'เงินที่ยังขาด = ' + (G - h) + ' แล้วหารด้วย ' + s };
});
T('W14', 'word', 'w', 2, 4, function (t) {
  var x = ri(10, 40) * (t - 1) + ri(5, 20), d = ri(5, 30), S = 2 * x + d, n = two(), tp = {}; tp[S - d] = 'ใช้วิธีผิด (ลืมหารสอง)';
  return { q: WP([n[0] + 'กับ' + n[1] + 'มีเงินรวมกัน ' + commas(S) + ' บาท ' + n[0] + 'มีมากกว่า' + n[1] + ' ' + d + ' บาท', n[0] + 'มีเงินกี่บาท']), ans: x + d, unit: 'บาท', traps: tp, explain: 'เอาส่วนต่างออก ' + S + ' − ' + d + ' = ' + (S - d) + ' แบ่งสองส่วนเท่ากัน ได้ส่วนน้อย ' + x + ' แล้วบวกส่วนต่างให้คนที่มีมากกว่า' };
});
T('W15', 'word', 'w', 1, 4, function (t) {
  var m = ri(4, 8), bx = ri(5, 9 + t), P = ri(20, 60), th = pick(['ส้ม', 'มะม่วง', 'ไข่ไก่', 'ลูกอม']), tp = {};
  if (t < 3) return { q: WP([th + ' ' + (m * bx) + ' ผล ใส่กล่องละ ' + m + ' ผล ขายกล่องละ ' + P + ' บาท', distract(t), 'ขายหมดทุกกล่องได้เงินกี่บาท']), ans: bx * P, unit: 'บาท', explain: 'หาจำนวนกล่อง ' + (m * bx) + ' ÷ ' + m + ' = ' + bx + ' แล้วคูณราคา' };
  var r = ri(1, m - 1); tp[(bx + 1) * P] = 'ลืมเศษที่เหลือ';
  return { q: WP([th + ' ' + (m * bx + r) + ' ผล ใส่กล่องละ ' + m + ' ผล (ต้องใส่ให้เต็มกล่องเท่านั้นจึงขาย) ขายกล่องละ ' + P + ' บาท', distract(t), 'ขายกล่องที่เต็มทั้งหมดได้เงินกี่บาท']), ans: bx * P, unit: 'บาท', traps: tp, explain: 'กล่องที่เต็มมี ' + bx + ' กล่อง ผลที่เหลือ ' + r + ' ผลไม่นับ' };
});
T('W16', 'word', 'w', 1, 4, function (t) {
  var k = ri(10, 30 + 5 * t), c = ri(5, 20), s = c + ri(2, 10), tp = {}, p = pick(PEOPLE); tp[k * s] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([p + 'ซื้อขนมมา ' + k + ' ชิ้น ราคาชิ้นละ ' + c + ' บาท แล้วขายหมดในราคาชิ้นละ ' + s + ' บาท', distract(t), p + 'ได้กำไรกี่บาท']), ans: k * (s - c), unit: 'บาท', traps: tp, explain: 'กำไรต่อชิ้น = ' + s + ' − ' + c + ' แล้วคูณจำนวนชิ้น' };
});
T('W17', 'word', 'w', 1, 4, function (t) {
  var a = ri(1, 1 + t), b = ri(1, 9) * 100, u = ri(2, Math.floor((a * 1000 + b) / 50) - 1) * 50;
  return { q: WP(['ซื้อน้ำตาล ' + a + ' กิโลกรัม กับอีก ' + b + ' กรัม ใช้ทำขนมไป ' + u + ' กรัม', distract(t), 'เหลือน้ำตาลกี่กรัม']), ans: a * 1000 + b - u, unit: 'กรัม', explain: '1 กิโลกรัม = 1,000 กรัม แปลงเป็นกรัมทั้งหมดก่อน' };
});
T('W18', 'word', 'w', 1, 4, function (t) {
  var A = ri(20, 60) + 10 * t, Cc = ri(10, A - 5), x = ri(1, 3), y = ri(2, 4), total = x * A + y * Cc, tp = {};
  if (t < 3) { tp[x * A] = 'อ่านโจทย์ไม่ครบ'; return { q: WP(['บัตรเข้าสวนสัตว์ ผู้ใหญ่ใบละ ' + A + ' บาท เด็กใบละ ' + Cc + ' บาท ซื้อบัตรผู้ใหญ่ ' + x + ' ใบ เด็ก ' + y + ' ใบ', distract(t), 'ต้องจ่ายกี่บาท']), ans: total, unit: 'บาท', traps: tp, explain: 'ผู้ใหญ่ ' + x + ' × ' + A + ' บวกเด็ก ' + y + ' × ' + Cc }; }
  var pay = (Math.floor(total / 100) + 1) * 100; tp[total] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP(['บัตรเข้าสวนสัตว์ ผู้ใหญ่ใบละ ' + A + ' บาท เด็กใบละ ' + Cc + ' บาท ซื้อบัตรผู้ใหญ่ ' + x + ' ใบ เด็ก ' + y + ' ใบ จ่ายด้วยเงิน ' + pay + ' บาท', distract(t), 'ได้เงินทอนกี่บาท']), ans: pay - total, unit: 'บาท', traps: tp, explain: 'หาราคารวม ' + total + ' แล้วนำไปลบจากเงินที่จ่าย' };
});
T('W19', 'word', 'w', 1, 4, function (t) {
  var m = ri(2, 6), pcs = ri(4, 6 + 2 * t), r = ri(1, m - 1), L = m * pcs + r, ask = chance(0.5);
  return { q: WP(['เชือกยาว ' + L + ' เมตร ตัดเป็นท่อน ท่อนละ ' + m + ' เมตร', distract(t), ask ? 'ตัดได้กี่ท่อน' : 'เหลือเชือกกี่เมตร']), ans: ask ? pcs : r, unit: ask ? 'ท่อน' : 'เมตร', explain: L + ' ÷ ' + m + ' ได้ ' + pcs + ' เศษ ' + r };
});
T('W20', 'word', 'w', 1, 4, function (t) {
  var n = ri(2, 5 + t), c = ri(2, 8) * 50, D = n * c + ri(50, 400), p = pick(PEOPLE), tp = {}; tp[n * c] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([p + 'ต้องวิ่งให้ครบ ' + commas(D) + ' เมตร สนามยาวรอบละ ' + c + ' เมตร วิ่งไปแล้ว ' + n + ' รอบ', distract(t), 'ต้องวิ่งอีกกี่เมตร']), ans: D - n * c, unit: 'เมตร', traps: tp, explain: 'ระยะที่วิ่งแล้ว ' + n + ' × ' + c + ' = ' + (n * c) + ' เมตร แล้วลบจากระยะทั้งหมด' };
});
T('W21', 'word', 'w', 1, 4, function (t) {
  var w = ri(20, 80), a = ri(3, 9) + t, m = ri(3, 8), q = ri(5, w + a * m - 5), tp = {}; tp[w + a * m] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP(['ถังน้ำมีน้ำอยู่ ' + w + ' ลิตร เปิดก๊อกเติมน้ำนาทีละ ' + a + ' ลิตร นาน ' + m + ' นาที แล้วตักน้ำออก ' + q + ' ลิตร', distract(t), 'ตอนนี้ในถังมีน้ำกี่ลิตร']), ans: w + a * m - q, unit: 'ลิตร', traps: tp, explain: 'น้ำที่เติม ' + a + ' × ' + m + ' = ' + (a * m) + ' ลิตร บวกกับของเดิม แล้วลบที่ตักออก' };
});
T('W22', 'word', 'w', 1, 4, function (t) {
  var n = two(), x = ri(5, 15 + 5 * t), k = ri(2, 3 + t), tp = {}; tp[k * x] = 'อ่านโจทย์ไม่ครบ';
  return { q: WP([n[0] + 'มีลูกอม ' + x + ' เม็ด ' + n[1] + 'มีลูกอมเป็น ' + k + ' เท่าของ' + n[0], distract(t), 'สองคนมีลูกอมรวมกันกี่เม็ด']), ans: x + k * x, unit: 'เม็ด', traps: tp, explain: n[1] + 'มี ' + x + ' × ' + k + ' = ' + (k * x) + ' เม็ด แล้วบวกของ' + n[0] };
});
/**
 * TemplatesObserve.gs — แม่แบบ "การสังเกต" 24 แบบ
 * กลุ่ม: seq = แบบรูปของจำนวน, vis = สังเกตรูป/ตาราง/การนับ, odd = หาตัวที่ไม่เข้าพวก, err = หาจุดผิดในวิธีทำ
 */
function seqQ(terms) { return 'หาจำนวนถัดไป\n' + terms.join(',  ') + ',  ?'; }
function colNames() { return ['หลักหน่วย', 'หลักสิบ', 'หลักร้อย', 'หลักพัน', 'หลักหมื่น']; }
function digitsRev(n) { return String(n).split('').reverse().map(Number); }
function digitSum(n) { return String(n).split('').reduce(function (s, x) { return s + +x; }, 0); }
function isSquare(n) { var r = Math.round(Math.sqrt(n)); return r * r === n; }
var SYMS = ['●', '▲', '■', '★', '◆', '♥'];

/* ---------------- แบบรูปของจำนวน ---------------- */
T('O01', 'observe', 'seq', 1, 4, function (t) {
  var d = [ri(2, 9), ri(5, 20), ri(10, 60), ri(25, 150)][t - 1], s = ri(1, 10 * t), terms = [];
  for (var i = 0; i < 5; i++) terms.push(s + i * d);
  return { q: seqQ(terms), ans: s + 5 * d, explain: 'แต่ละจำนวนเพิ่มขึ้นทีละ ' + d };
});
T('O02', 'observe', 'seq', 1, 4, function (t) {
  var r = t <= 2 ? ri(2, 3) : ri(2, 4), s = ri(1, 4), terms = [], n = t === 1 ? 4 : 5;
  for (var i = 0; i < n; i++) terms.push(s * Math.pow(r, i));
  return { q: seqQ(terms), ans: s * Math.pow(r, n), explain: 'แต่ละจำนวนคูณด้วย ' + r };
});
T('O03', 'observe', 'seq', 1, 4, function (t) {
  var d0 = ri(1, 3) + (t > 2 ? 2 : 0), inc = ri(1, 2) + (t > 3 ? 1 : 0), s = ri(1, 10 * t), terms = [s], d = d0;
  for (var i = 0; i < 4; i++) { terms.push(terms[terms.length - 1] + d); d += inc; }
  return { q: seqQ(terms), ans: terms[4] + d, explain: 'ส่วนต่างเพิ่มขึ้นทีละ ' + inc + ' (' + d0 + ', ' + (d0 + inc) + ', ...) ต่อไปบวก ' + d };
});
T('O04', 'observe', 'seq', 2, 4, function (t) {
  var a = ri(1, 9), b = ri(20, 40), d1 = ri(2, 5) + t, d2 = ri(2, 5) + t, terms = [];
  for (var i = 0; i < 7; i++) terms.push(i % 2 === 0 ? a + (i / 2) * d1 : b + ((i - 1) / 2) * d2);
  return { q: 'มีสองแบบรูปสลับกัน หาจำนวนถัดไป\n' + terms.join(',  ') + ',  ?', ans: b + 3 * d2, explain: 'ตำแหน่งคู่ (2, 4, 6, 8) เพิ่มทีละ ' + d2 + ' แยกดูทีละแบบรูป' };
});
T('O05', 'observe', 'seq', 1, 4, function (t) {
  var d = [ri(2, 9), ri(5, 15), ri(10, 40), ri(20, 80)][t - 1], s = ri(5, 9) * d + ri(0, d), terms = [];
  for (var i = 0; i < 5; i++) terms.push(s - i * d);
  return { q: seqQ(terms), ans: s - 5 * d, explain: 'แต่ละจำนวนลดลงทีละ ' + d };
});
T('O06', 'observe', 'seq', 2, 4, function (t) {
  var a = ri(1, 4), b = ri(1, 5) + a, terms = [a, b];
  for (var i = 2; i < 6; i++) terms.push(terms[i - 1] + terms[i - 2]);
  return { q: seqQ(terms), ans: terms[5] + terms[4], explain: 'แต่ละจำนวนเท่ากับสองจำนวนก่อนหน้ารวมกัน' };
});
T('O07', 'observe', 'seq', 2, 4, function (t) {
  var terms = [], i;
  if (chance(0.5)) {
    var s = ri(1, 3), c = t > 3 ? ri(1, 5) : 0;
    for (i = 0; i < 5; i++) terms.push((s + i) * (s + i) + c);
    return { q: seqQ(terms), ans: (s + 5) * (s + 5) + c, explain: 'จำนวนกำลังสอง ' + (s) + '×' + (s) + ', ' + (s + 1) + '×' + (s + 1) + ', ...' + (c ? ' แล้วบวก ' + c : '') };
  }
  var sum = 0;
  for (i = 1; i <= 5; i++) { sum += i; terms.push(sum); }
  return { q: seqQ(terms), ans: sum + 6, explain: 'ส่วนต่างเพิ่มทีละ 1 (+2, +3, +4, +5) ต่อไปบวก 6' };
});
T('O09', 'observe', 'seq', 1, 4, function (t) {
  var a = ri(2, 5), d = ri(2, 4), n = ri(8, 10 + 5 * t), sh = ri(0, 1);
  var w = [1, 2, 3].map(function (k) { return 'รูปที่ ' + k + ' มี ' + (a + d * (k - 1)) + ' จุด'; });
  return { q: w.join('\n') + '\nรูปที่ ' + n + ' มีกี่จุด', ans: a + d * (n - 1), unit: 'จุด', explain: 'รูปที่ 1 มี ' + a + ' จุด แต่ละรูปเพิ่มทีละ ' + d + ' ไปอีก ' + (n - 1) + ' รูป' };
});
T('O23', 'observe', 'seq', 1, 4, function (t) {
  var a = t === 2 ? 1 : ri(2, 4), b = t === 1 ? 0 : ri(1, 6), n = ri(8, 20), ins = shuffle([2, 3, 4, 5, 6]).slice(0, 3).sort(function (x, y) { return x - y; });
  var rows = ins.map(function (x) { return x + '  →  ' + (a * x + b); });
  return { q: 'เครื่องเปลี่ยนจำนวนทำงานตามกฎอย่างหนึ่ง\n' + rows.join('\n') + '\nถ้าใส่ ' + n + ' จะได้เท่าไร', ans: a * n + b, explain: 'กฎคือ ' + (a > 1 ? 'คูณ ' + a : '') + (a > 1 && b ? ' แล้ว' : '') + (b ? 'บวก ' + b : '') };
});

/* ---------------- สังเกตรูป / ตาราง / การนับ ---------------- */
T('O08', 'observe', 'vis', 1, 4, function (t) {
  var k = ri(2, t > 2 ? 4 : 3), pat = sample(SYMS, k), len = k * ri(2, 3) + ri(1, k - 1), shown = [];
  for (var i = 0; i < len; i++) shown.push(pat[i % k]);
  var ans = pat[len % k], ch = mkChoices(ans, SYMS.filter(function (s) { return s !== ans; }), 4);
  return { type: 'choice', q: 'รูปถัดไปคือรูปใด\n' + shown.join(' ') + ' ?', choices: ch.choices, ans: ch.ans, explain: 'ลวดลายซ้ำทุก ' + k + ' รูป: ' + pat.join(' ') };
});
T('O19', 'observe', 'vis', 1, 4, function (t) {
  var f = t <= 2 ? function (a, b) { return a + b; } : function (a, b) { return 2 * a + b; };
  var rows = [], i;
  for (i = 0; i < 3; i++) { var a = ri(2, 9 + 3 * t), b = ri(2, 9 + 3 * t); rows.push([a, b, f(a, b)]); }
  var ans = rows[2][2]; rows[2][2] = '?';
  return { q: 'ตัวเลขในแต่ละแถวมีกฎเดียวกัน ช่อง ? คือจำนวนใด', data: { kind: 'table', head: null, rows: rows }, ans: ans, explain: t <= 2 ? 'ช่องที่ 3 = ช่องที่ 1 + ช่องที่ 2' : 'ช่องที่ 3 = ช่องที่ 1 × 2 + ช่องที่ 2' };
});
T('O20', 'observe', 'vis', 1, 4, function (t) {
  var pool = sample(SYMS, 3), len = 16 + 4 * t, arr = [], i;
  for (i = 0; i < len; i++) arr.push(pick(pool));
  var target = pick(pool);
  var cnt = arr.filter(function (x) { return x === target; }).length;
  if (cnt < 2) { arr[0] = target; arr[1] = target; cnt = arr.filter(function (x) { return x === target; }).length; }
  var rows = []; for (i = 0; i < len; i += 8) rows.push(arr.slice(i, i + 8).join(' '));
  return { q: 'นับว่ามี ' + target + ' ทั้งหมดกี่ตัว\n' + rows.join('\n'), ans: cnt, explain: 'นับทีละแถว แล้วรวมกัน ระวังอย่านับซ้ำหรือข้าม' };
});
T('O21', 'observe', 'vis', 1, 4, function (t) {
  var pool = sample(SYMS, 3), len = 8 + t * 2, a = [], i;
  for (i = 0; i < len; i++) a.push(pick(pool));
  var k = ri(1, Math.min(4, 1 + t)), idx = sample(a.map(function (_, j) { return j; }), k), b = a.slice();
  idx.forEach(function (j) { b[j] = pick(pool.filter(function (s) { return s !== a[j]; })); });
  return { q: 'สองแถวนี้ต่างกันกี่ตำแหน่ง\nแถวบน:  ' + a.join(' ') + '\nแถวล่าง: ' + b.join(' '), ans: k, unit: 'ตำแหน่ง', explain: 'เทียบทีละตำแหน่งจากซ้ายไปขวา แล้วนับตำแหน่งที่ไม่เหมือนกัน' };
});
T('O24', 'observe', 'vis', 1, 4, function (t) {
  var nums = [], rep = ri(10, 99), n = 7 + t;
  while (nums.length < n) { var x = ri(10, 99); if (x !== rep && nums.indexOf(x) < 0) nums.push(x); }
  var list = shuffle(nums.concat([rep, rep, rep]));
  return { q: 'ในรายการนี้ ตัวเลขใดปรากฏบ่อยที่สุด\n' + list.join(',  '), ans: rep, explain: 'นับว่าแต่ละตัวเลขปรากฏกี่ครั้ง ตัวที่ปรากฏ 3 ครั้งคือ ' + rep };
});

/* ---------------- หาตัวที่ไม่เข้าพวก ---------------- */
function oddItem(vals, oddVal, expl, qtxt) {
  var all = shuffle(vals.concat([oddVal])).map(String);
  return { type: 'choice', q: qtxt || 'ข้อใดไม่เข้าพวก', choices: all, ans: String(all.indexOf(String(oddVal)) + 1), explain: expl };
}
T('O10', 'observe', 'odd', 1, 4, function (t) {
  var kind = t === 1 ? 'par' : t === 2 ? 'mul' : t === 3 ? 'sq' : pick(['mul', 'sq']);
  var vals, odd, e;
  if (kind === 'par') {
    var oddPar = chance(0.5) ? 1 : 0, pool = [];
    while (pool.length < 4) { var x = ri(11, 99); if (pool.indexOf(x) < 0) pool.push(x); }
    var same = [], other;
    pool.forEach(function (x) { if (same.length < 3 && x % 2 === oddPar) same.push(x); });
    while (same.length < 3) { var y = ri(11, 99); if (y % 2 === oddPar && same.indexOf(y) < 0) same.push(y); }
    do { other = ri(11, 99); } while (other % 2 === oddPar || same.indexOf(other) >= 0);
    return oddItem(same, other, 'สามจำนวนเป็นเลข' + (oddPar ? 'คี่' : 'คู่') + ' แต่ ' + other + ' เป็นเลข' + (oddPar ? 'คู่' : 'คี่'), 'จำนวนใดไม่เข้าพวก');
  }
  if (kind === 'mul') {
    var k = t === 2 ? pick([3, 4, 5, 6]) : pick([6, 7, 8, 9]), ms = sample([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3).map(function (m) { return m * k; });
    do { odd = ri(2 * k, 12 * k); } while (odd % k === 0);
    return oddItem(ms, odd, 'สามจำนวนเป็นพหุคูณของ ' + k + ' แต่ ' + odd + ' หาร ' + k + ' ไม่ลงตัว', 'จำนวนใดไม่เข้าพวก');
  }
  var sq = sample([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3).map(function (m) { return m * m; });
  do { odd = ri(5, 150); } while (isSquare(odd) || Math.abs(odd - sq[0]) < 1);
  return oddItem(sq, odd, 'สามจำนวนเป็นจำนวนกำลังสอง (เช่น 4 = 2×2) แต่ ' + odd + ' ไม่ใช่', 'จำนวนใดไม่เข้าพวก');
});
T('O11', 'observe', 'odd', 2, 4, function (t) {
  var S = ri(6, 16), len = t >= 3 ? 3 : 2, vals = [];
  while (vals.length < 3) { var x = rndN(len); if (digitSum(x) === S && vals.indexOf(x) < 0) vals.push(x); }
  var odd; do { odd = rndN(len); } while (digitSum(odd) === S);
  return oddItem(vals, odd, 'สามจำนวนมีผลบวกของเลขโดดเท่ากับ ' + S + ' แต่ ' + odd + ' มีผลบวก ' + digitSum(odd), 'จำนวนใดไม่เข้าพวก (ลองบวกเลขโดดในแต่ละจำนวน)');
});
var WORD_GROUPS = [
  ['ผลไม้', ['แอปเปิ้ล', 'กล้วย', 'ส้ม', 'องุ่น', 'มะม่วง']], ['สัตว์เลี้ยง', ['แมว', 'สุนัข', 'กระต่าย', 'หนูแฮมสเตอร์', 'นกแก้ว']],
  ['ยานพาหนะ', ['รถยนต์', 'เรือ', 'เครื่องบิน', 'จักรยาน', 'รถไฟ']], ['เครื่องเขียน', ['ดินสอ', 'ปากกา', 'ไม้บรรทัด', 'ยางลบ', 'กรรไกร']],
  ['ผัก', ['แครอท', 'ผักกาด', 'มะเขือ', 'ฟักทอง', 'กะหล่ำปลี']], ['เครื่องแต่งกาย', ['เสื้อ', 'กางเกง', 'หมวก', 'ถุงเท้า', 'กระโปรง']]
];
T('O12', 'observe', 'odd', 1, 4, function (t) {
  var g = sample(WORD_GROUPS, 2);
  var three = sample(g[0][1], 3), odd = pick(g[1][1]);
  return oddItem(three, odd, 'สามคำเป็น' + g[0][0] + ' แต่ ' + odd + ' เป็น' + g[1][0], 'คำใดไม่เข้าพวก');
});
T('O22', 'observe', 'odd', 2, 4, function (t) {
  var S = ri(7, 18), len = t >= 3 ? 3 : 2, ans, others = [];
  ans = retry(function () { return rndN(len); }, function (x) { return digitSum(x) === S; });
  while (others.length < 3) { var x = rndN(len); if (digitSum(x) !== S && others.indexOf(x) < 0) others.push(x); }
  var all = shuffle(others.concat([ans])).map(String);
  return { type: 'choice', q: 'จำนวนใดมีผลบวกของเลขโดดเท่ากับ ' + S, choices: all, ans: String(all.indexOf(String(ans)) + 1), explain: 'ลองบวกเลขโดดของแต่ละจำนวน จำนวนที่ได้ ' + S + ' คือ ' + ans };
});
T('O18', 'observe', 'odd', 1, 4, function (t) {
  var d = [ri(2, 9), ri(5, 20), ri(10, 50), ri(20, 90)][t - 1], s = ri(1, 20), terms = [], i;
  for (i = 0; i < 6; i++) terms.push(s + i * d);
  var k = ri(0, 5), wrong;
  do { wrong = terms[k] + pick([-1, 1, -2, 2, -d, d, 10, -10]); } while (wrong < 0 || terms.indexOf(wrong) >= 0 || wrong === terms[k]);
  var shown = terms.slice(); shown[k] = wrong;
  return { type: 'choice', q: 'ลำดับนี้มีตัวเลขหนึ่งตัวที่ผิดแบบรูป ตัวใดผิด\n(แต่ละจำนวนเพิ่มขึ้นอย่างสม่ำเสมอ)', choices: shown.map(String), ans: String(k + 1), explain: 'แบบรูปที่ถูกคือเพิ่มทีละ ' + d + ' จำนวนที่ถูกต้องตำแหน่งนี้ควรเป็น ' + terms[k] };
});

/* ---------------- หาจุดผิดในวิธีทำ (ตอบด้วยการแตะบรรทัดแรกที่ผิด) ---------------- */
function errItem(q, lines, k, why) {
  return { type: 'choice', q: q, choices: lines, ans: String(k + 1), lineMode: true, defErr: 'หาจุดผิดไม่เจอ', explain: why };
}
T('O13', 'observe', 'err', 1, 4, function (t) {
  var la = t <= 1 ? 2 : (t <= 3 ? 3 : 4), nm = colNames(), i;
  var ab = retry(function () { return [rndN(la), rndN(la)]; }, function (p) {
    var da = digitsRev(p[0]), db = digitsRev(p[1]), c = 0, ok = false;
    for (var j = 0; j < la; j++) { if (j >= 1 && c > 0) ok = true; c = (da[j] + db[j] + c) >= 10 ? 1 : 0; }
    return ok;
  });
  var a = ab[0], b = ab[1], da = digitsRev(a), db = digitsRev(b), c = 0, carryIn = [], ks = [];
  for (i = 0; i < la; i++) { carryIn[i] = c; if (i >= 1 && c > 0) ks.push(i); c = (da[i] + db[i] + c) >= 10 ? 1 : 0; }
  var k = pick(ks), lines = [], cc = 0, num = 0;
  for (i = 0; i < la; i++) {
    var withC = cc > 0 && i !== k, s = da[i] + db[i] + (withC ? cc : 0);
    lines.push(nm[i] + ': ' + da[i] + ' + ' + db[i] + (withC ? ' + ' + cc + ' (ที่ทดมา)' : '') + ' = ' + s + (i < la - 1 && s >= 10 ? ' เขียน ' + (s % 10) + ' ทด 1' : ' เขียน ' + s));
    num += (i < la - 1 ? s % 10 : s) * Math.pow(10, i);
    cc = i < la - 1 && s >= 10 ? 1 : 0;
  }
  lines.push('ตอบ ' + num);
  return errItem(pick(PEOPLE) + 'คิดบวก ' + a + ' + ' + b + ' ไว้ดังนี้\nบรรทัดแรกที่ผิดคือบรรทัดไหน (แตะเลือก)', lines, k, 'ที่' + nm[k - 1] + 'ทดไว้ 1 แต่' + nm[k] + 'ไม่ได้นำเลขที่ทดมาบวก');
});
T('O14', 'observe', 'err', 1, 4, function (t) {
  var la = t <= 1 ? 2 : (t <= 3 ? 3 : 4), nm = colNames(), i;
  var p = retry(function () { return [rndN(la), rndN(la)]; }, function (p) {
    return p[0] > p[1] && borrows(p[0], p[1]) >= 1 && digitsRev(p[0]).every(function (d) { return d >= 1; }) && borrows(p[0], p[1]) < la;
  });
  var a = p[0], b = p[1], da = digitsRev(a), db = digitsRev(b), br = 0, needs = [];
  for (i = 0; i < la; i++) { var x0 = da[i] - br; if (x0 < db[i]) { needs.push(i); br = 1; } else br = 0; }
  var k = pick(needs.filter(function (j) { return j < la - 1; }).concat(needs.length ? [] : [0]));
  if (k === undefined) k = needs[0];
  var lines = [], num = 0; br = 0;
  for (i = 0; i < la; i++) {
    var x = da[i] - br, y = db[i], d, line = nm[i] + ': ' + (br ? da[i] + ' ถูกยืมไป 1 เหลือ ' + x + '; ' : '');
    if (i === k) { d = y - x; line += y + ' − ' + x + ' = ' + d; br = 0; }
    else if (x >= y) { d = x - y; line += x + ' − ' + y + ' = ' + d; br = 0; }
    else { d = x + 10 - y; line += x + ' ไม่พอลบ ยืม 10 ได้ ' + (x + 10) + ' − ' + y + ' = ' + d; br = 1; }
    lines.push(line); num += d * Math.pow(10, i);
  }
  lines.push('ตอบ ' + num);
  return errItem(pick(PEOPLE) + 'คิดลบ ' + a + ' − ' + b + ' ไว้ดังนี้\nบรรทัดแรกที่ผิดคือบรรทัดไหน (แตะเลือก)', lines, k, nm[k] + ': เลขบนน้อยกว่าเลขล่าง ต้องยืมจากหลักถัดไป จะเอาเลขมากลบเลขน้อยสลับกันไม่ได้');
});
T('O15', 'observe', 'err', 1, 4, function (t) {
  var la = t <= 2 ? 3 : 4, nm = colNames(), i;
  var p = retry(function () { return [rndN(la), ri(3, 9)]; }, function (p) {
    var da = digitsRev(p[0]), c = 0, ok = false;
    for (var j = 0; j < la; j++) { if (j >= 1 && c > 0) ok = true; c = Math.floor((da[j] * p[1] + c) / 10); }
    return ok;
  });
  var a = p[0], b = p[1], da = digitsRev(a), c = 0, ks = [];
  for (i = 0; i < la; i++) { if (i >= 1 && c > 0) ks.push(i); c = Math.floor((da[i] * b + c) / 10); }
  var k = pick(ks), lines = [], cc = 0, num = 0;
  for (i = 0; i < la; i++) {
    var withC = cc > 0 && i !== k, pr = da[i] * b, v = pr + (withC ? cc : 0);
    var line = nm[i] + ': ' + da[i] + ' × ' + b + ' = ' + pr + (withC ? ' + ' + cc + ' = ' + v : '');
    line += (i < la - 1 && v >= 10) ? ' เขียน ' + (v % 10) + ' ทด ' + Math.floor(v / 10) : ' เขียน ' + v;
    lines.push(line);
    num += (i < la - 1 ? v % 10 : v) * Math.pow(10, i);
    cc = i < la - 1 ? Math.floor(v / 10) : 0;
  }
  lines.push('ตอบ ' + num);
  return errItem(pick(PEOPLE) + 'คิดคูณ ' + a + ' × ' + b + ' ไว้ดังนี้\nบรรทัดแรกที่ผิดคือบรรทัดไหน (แตะเลือก)', lines, k, nm[k] + ': ลืมนำเลขที่ทดมาบวกกับผลคูณ');
});
T('O16', 'observe', 'err', 2, 4, function (t) {
  var a = ri(12, 49), b = retry(function () { return ri(12, 49); }, function (x) { return x % 10 !== 0; }), u = b % 10, tn = Math.floor(b / 10);
  var p1 = a * u, p2 = a * tn * 10, m = ri(1, 3), l1 = p1, l2 = p2, l2txt = a + ' × ' + tn + '0 = ', k, why;
  if (m === 1) { l1 = p1 + pick([10, -10, 1, -1]); k = 0; why = a + ' × ' + u + ' = ' + p1 + ' ไม่ใช่ ' + l1; }
  else if (m === 2) { l2 = a * tn; k = 1; why = 'การคูณด้วยหลักสิบ ต้องเลื่อนหลัก (เติมศูนย์) ' + a + ' × ' + tn + '0 = ' + p2; }
  else { l2 = p2 + pick([10, -10, 100]); k = 1; why = a + ' × ' + tn + '0 = ' + p2 + ' ไม่ใช่ ' + l2; }
  var lines = [a + ' × ' + u + ' = ' + l1, l2txt + l2, l1 + ' + ' + l2 + ' = ' + (l1 + l2), 'ตอบ ' + (l1 + l2)];
  return errItem(pick(PEOPLE) + 'คิดคูณ ' + a + ' × ' + b + ' ไว้ดังนี้\nบรรทัดแรกที่ผิดคือบรรทัดไหน (แตะเลือก)', lines, k, why);
});
T('O17', 'observe', 'err', 2, 4, function (t) {
  var pr = pick([[2, 3], [3, 4], [2, 5], [3, 5], [4, 6]]), d1 = pr[0], d2 = pr[1], L = lcm(d1, d2);
  var a = ri(1, d1 - 1), c = ri(1, d2 - 1), n1 = a * L / d1, n2 = c * L / d2, m = ri(2, 4), x1 = n1, x2 = n2, lastDen = L, k, why;
  if (m === 2) { x1 = a; k = 1; why = F(a, d1) + ' = ' + F(n1, L) + ' ต้องคูณทั้งตัวเศษและตัวส่วน'; }
  else if (m === 3) { x2 = c; k = 2; why = F(c, d2) + ' = ' + F(n2, L) + ' ต้องคูณทั้งตัวเศษและตัวส่วน'; }
  else { lastDen = L + L; k = 3; why = 'เมื่อตัวส่วนเท่ากันแล้ว บวกเฉพาะตัวเศษ ตัวส่วนยังคงเป็น ' + L; }
  var lines = ['ตัวส่วนร่วมของ ' + d1 + ' และ ' + d2 + ' คือ ' + L,
    F(a, d1) + ' = ' + F(x1, m === 2 ? L : L), F(c, d2) + ' = ' + F(x2, L),
    F(x1, L) + ' + ' + F(x2, L) + ' = ' + F(x1 + x2, lastDen)];
  if (m === 2) lines[1] = F(a, d1) + ' = ' + F(a, L);
  if (m === 3) lines[2] = F(c, d2) + ' = ' + F(c, L);
  return errItem(pick(PEOPLE) + 'คิดบวก ' + F(a, d1) + ' + ' + F(c, d2) + ' ไว้ดังนี้\nบรรทัดแรกที่ผิดคือบรรทัดไหน (แตะเลือก)', lines, k, why);
});
/**
 * TemplatesAnalytic.gs — แม่แบบ "คิดวิเคราะห์" 22 แบบ
 * กลุ่ม: data = อ่านตาราง/แผนภูมิ, logic = ตรรกะ/ปริศนา, count = นับ/จัดกลุ่ม
 */
var ITEM_NAMES = ['แอปเปิ้ล', 'ส้ม', 'กล้วย', 'มะม่วง', 'องุ่น', 'ลำไย'];
var WEEKDAYS5 = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

/* ---------------- อ่านตาราง / แผนภูมิ ---------------- */
T('A01', 'analytic', 'data', 1, 4, function (t) {
  var th = pick(['ขนมปัง', 'น้ำส้ม', 'ไอศกรีม', 'หนังสือ']), vals = WEEKDAYS5.map(function () { return ri(10, 30) * t + ri(0, 9); });
  var rows = WEEKDAYS5.map(function (d, i) { return [d, vals[i]]; });
  var base = { data: { kind: 'table', head: ['วัน', 'ขายได้ (ชิ้น)'], rows: rows, title: 'ร้านขาย' + th + ' ขายได้แต่ละวัน' } };
  var r = ri(0, 3), mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals), i1 = ri(0, 4), i2 = (i1 + ri(1, 4)) % 5;
  var tot = vals.reduce(function (s, x) { return s + x; }, 0);
  if (r === 0) base.q = 'ตลอดทั้ง 5 วัน ขาย' + th + 'ได้รวมกี่ชิ้น', base.ans = tot;
  else if (r === 1) base.q = 'วันที่ขายได้มากที่สุดกับน้อยที่สุด ต่างกันกี่ชิ้น', base.ans = mx - mn;
  else if (r === 2) base.q = 'วัน' + WEEKDAYS5[i1] + 'และวัน' + WEEKDAYS5[i2] + ' ขายได้รวมกันกี่ชิ้น', base.ans = vals[i1] + vals[i2];
  else base.q = 'วัน' + WEEKDAYS5[i1] + 'ขายได้มากกว่าวัน' + WEEKDAYS5[i2] + 'กี่ชิ้น (ถ้าน้อยกว่าให้ตอบผลต่าง)', base.ans = Math.abs(vals[i1] - vals[i2]);
  base.unit = 'ชิ้น'; base.explain = 'อ่านค่าจากตารางให้ตรงแถว แล้วค่อยคำนวณ';
  return base;
});
T('A02', 'analytic', 'data', 1, 4, function (t) {
  var names = sample(ITEM_NAMES, ri(4, 5)), st = [5, 10, 10, 20][t - 1], vals = names.map(function () { return ri(2, 9) * st; });
  var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
  if (mx === mn) vals[0] += st;
  mx = Math.max.apply(null, vals); mn = Math.min.apply(null, vals);
  return { q: 'ผลไม้ที่มีมากที่สุดกับน้อยที่สุด ต่างกันกี่ผล', data: { kind: 'bar', title: 'จำนวนผลไม้ในตะกร้า', labels: names, values: vals, unit: 'ผล' }, ans: mx - mn, unit: 'ผล', explain: 'อ่านค่าที่ปลายแท่งของแผนภูมิ แล้วลบกัน' };
});
T('A03', 'analytic', 'data', 1, 4, function (t) {
  var n = two(), names = ['ป.1', 'ป.2', 'ป.3', 'ป.4'], st = [5, 10, 10, 20][t - 1], vals = names.map(function () { return ri(3, 9) * st; });
  var r = ri(0, 2), i = ri(0, 3), j = (i + ri(1, 3)) % 4, tot = vals.reduce(function (s, x) { return s + x; }, 0), q, ans;
  if (r === 0) { q = 'นักเรียน ' + names[i] + ' กับ ' + names[j] + ' รวมกันกี่คน'; ans = vals[i] + vals[j]; }
  else if (r === 1) { q = 'นักเรียนทั้ง 4 ชั้นรวมกันกี่คน'; ans = tot; }
  else { q = names[i] + ' ต้องมีนักเรียนเพิ่มอีกกี่คน จึงจะเท่ากับ ' + names[j] + ' (ถ้า ' + names[i] + ' มากกว่าให้ตอบผลต่าง)'; ans = Math.abs(vals[i] - vals[j]); }
  return { q: q, data: { kind: 'bar', title: 'จำนวนนักเรียนที่มาเข้าแถว', labels: names, values: vals, unit: 'คน' }, ans: ans, unit: 'คน', explain: 'อ่านค่าของแต่ละแท่งก่อน แล้วค่อยคำนวณ' };
});
T('A04', 'analytic', 'data', 1, 4, function (t) {
  var menu = sample([['ข้าวผัด', 35], ['น้ำเปล่า', 10], ['ไข่ดาว', 12], ['ส้มตำ', 30], ['ขนมครก', 20], ['น้ำส้ม', 15]], 4), rows = menu.map(function (m) { return [m[0], m[1] + t * 5 * 0]; });
  var a = ri(0, 3), b = (a + ri(1, 3)) % 4, ka = ri(1, 2 + (t > 2 ? 1 : 0)), kb = ri(1, 3), total = menu[a][1] * ka + menu[b][1] * kb, pay = (Math.floor(total / 50) + 1) * 50, tp = {};
  tp[total] = 'อ่านโจทย์ไม่ครบ';
  return { q: 'ซื้อ' + menu[a][0] + ' ' + ka + ' ที่ และ' + menu[b][0] + ' ' + kb + ' ที่ จ่ายเงิน ' + pay + ' บาท ได้เงินทอนกี่บาท', data: { kind: 'table', head: ['รายการ', 'ราคา (บาท)'], rows: rows, title: 'รายการอาหาร' }, ans: pay - total, unit: 'บาท', traps: tp, explain: 'หาราคารวมจากตารางราคาก่อน แล้วลบจากเงินที่จ่าย' };
});
T('A16', 'analytic', 'data', 1, 4, function (t) {
  var k = pick([15, 20, 25, 30]), h = ri(6, 15), times = [0, 1, 2, 3, 4].map(function (i) { return h * 60 + i * k; });
  function hm(m) { return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
  var arr = ri(times[1] + 1, times[2] - 1), nxt = times[2];
  return { q: 'ป้ายรถเมล์มีรถออกเวลา ' + times.map(hm).join(', ') + ' น.\nต้นมาถึงป้ายเวลา ' + hm(arr) + ' น. ต้องรอรถคันถัดไปกี่นาที', ans: nxt - arr, unit: 'นาที', explain: 'หารถคันแรกที่ออกหลังเวลา ' + hm(arr) + ' คือ ' + hm(nxt) + ' แล้วหาผลต่างเป็นนาที' };
});
T('A18', 'analytic', 'data', 2, 4, function (t) {
  var c = ri(3, 8), a = ri(c + 3, 20), b = ri(c + 3, 20), un = a + b - c, N = un + ri(2, 8), ask = t >= 3;
  return { q: 'ในห้องเรียนมีนักเรียน ' + N + ' คน ชอบว่ายน้ำ ' + a + ' คน ชอบวาดรูป ' + b + ' คน ชอบทั้งสองอย่าง ' + c + ' คน' + (ask ? '\nมีนักเรียนที่ไม่ชอบทั้งสองอย่างกี่คน' : '\nมีนักเรียนที่ชอบอย่างน้อยหนึ่งอย่างกี่คน'), ans: ask ? N - un : un, unit: 'คน', traps: (function () { var o = {}; o[a + b] = 'นับคนที่ชอบทั้งสองซ้ำ'; return o; })(), explain: 'คนที่ชอบทั้งสองอย่างถูกนับซ้ำ 2 ครั้ง ต้องลบออก 1 ครั้ง: ' + a + ' + ' + b + ' − ' + c + ' = ' + un };
});

/* ---------------- ตรรกะ / ปริศนา ---------------- */
T('A05', 'analytic', 'logic', 1, 4, function (t) {
  var n = t <= 2 ? 3 : 4, names = sample(PEOPLE, n), order = names.slice(), ask = pick(['สูงที่สุด', 'เตี้ยที่สุด']), clues = [];
  for (var i = 0; i < n - 1; i++) clues.push(chance(0.5) ? order[i] + 'สูงกว่า' + order[i + 1] : order[i + 1] + 'เตี้ยกว่า' + order[i]);
  var ans = ask === 'สูงที่สุด' ? order[0] : order[n - 1], ch = mkChoices(ans, names, n);
  return { type: 'choice', q: shuffle(clues).join('\n') + '\nใคร' + ask, choices: ch.choices, ans: ch.ans, explain: 'เรียงลำดับจากข้อมูล: ' + order.join(' > ') + ' (สูง → เตี้ย)' };
});
T('A06', 'analytic', 'logic', 1, 4, function (t) {
  var ppl = sample(PEOPLE, 3), pets = sample(['แมว', 'สุนัข', 'ปลา', 'กระต่าย', 'นกแก้ว'], 3), x = pets[0], y = pets[1], z = pets[2];
  var clues = [ppl[1] + 'เลี้ยง' + y, ppl[0] + 'ไม่ได้เลี้ยง' + z], askC = chance(0.5), who = askC ? ppl[2] : ppl[0], ans = askC ? z : x;
  var ch = mkChoices(ans, pets, 3);
  return { type: 'choice', q: ppl.join(' ') + ' เลี้ยงสัตว์คนละชนิด คือ ' + pets.join(' ') + ' (คนละ 1 ตัว)\n' + shuffle(clues).join('\n') + '\n' + who + 'เลี้ยงอะไร', choices: ch.choices, ans: ch.ans, explain: ppl[1] + 'เลี้ยง' + y + ' และ' + ppl[0] + 'ไม่ได้เลี้ยง' + z + ' จึงเหลือให้' + ppl[0] + 'เลี้ยง' + x + ' และ' + ppl[2] + 'เลี้ยง' + z };
});
T('A07', 'analytic', 'logic', 1, 4, function (t) {
  var x = ri(2, 12 + 5 * t), a = ri(2, 5), b = ri(2, 9), c = ri(1, x - 1), v = ri(1, 3), q, r;
  if (t <= 2 && v !== 3) { if (v === 1) { r = x * a + b; q = 'คูณด้วย ' + a + ' แล้วบวก ' + b; } else { r = (x + b) * a; q = 'บวก ' + b + ' แล้วคูณด้วย ' + a; } }
  else { r = (x - c) * a + b; q = 'ลบ ' + c + ' แล้วคูณด้วย ' + a + ' แล้วบวก ' + b; }
  return { q: 'ฉันคิดจำนวนหนึ่งไว้ ' + q + ' ได้ ' + r + ' จำนวนที่ฉันคิดไว้คือเท่าไร', ans: x, explain: 'ทำย้อนกลับจากคำตอบทีละขั้น: ' + r + ' แล้วทำตรงข้าม (บวก↔ลบ, คูณ↔หาร) ย้อนไปจนถึงจำนวนตั้งต้น' };
});
T('A08', 'analytic', 'logic', 1, 4, function (t) {
  var f = sample(ITEM_NAMES, 3), k1 = ri(2, 3 + (t > 2 ? 1 : 0)), k2 = ri(2, 3 + (t > 2 ? 2 : 0)), m = ri(2, 3 + t);
  return { q: f[0] + ' 1 ผล หนักเท่ากับ' + f[1] + ' ' + k1 + ' ผล\n' + f[1] + ' 1 ผล หนักเท่ากับ' + f[2] + ' ' + k2 + ' ผล\n' + f[0] + ' ' + m + ' ผล หนักเท่ากับ' + f[2] + 'กี่ผล', ans: m * k1 * k2, unit: 'ผล', explain: f[0] + ' 1 ผล = ' + f[1] + ' ' + k1 + ' ผล = ' + f[2] + ' ' + (k1 * k2) + ' ผล แล้วคูณ ' + m };
});
T('A12', 'analytic', 'logic', 1, 4, function (t) {
  var x = ri(5, 20 * t + 5), d = ri(3, 20), S = 2 * x + d;
  return { q: 'จำนวนสองจำนวนรวมกันได้ ' + S + ' และต่างกัน ' + d + ' จำนวนที่น้อยกว่าคือเท่าไร', ans: x, explain: 'ตัดส่วนต่างออก ' + S + ' − ' + d + ' = ' + (S - d) + ' แล้วแบ่งสองส่วนเท่ากัน' };
});
T('A13', 'analytic', 'logic', 2, 4, function (t) {
  var g = ri(2, 4 + t), c = ri(2, 5 + t), h = g + c, legs = 2 * c + 4 * g;
  return { q: 'ในคอกมีไก่และแพะรวม ' + h + ' ตัว นับขาได้ทั้งหมด ' + legs + ' ขา (ไก่ 2 ขา แพะ 4 ขา)\nมีแพะกี่ตัว', ans: g, unit: 'ตัว', explain: 'ถ้าทุกตัวเป็นไก่จะมี ' + (2 * h) + ' ขา ขาที่เกินมา ' + (legs - 2 * h) + ' ขา มาจากแพะ ตัวละ 2 ขาที่เกิน → ' + g + ' ตัว' };
});
T('A17', 'analytic', 'logic', 2, 4, function (t) {
  var tn = ri(2, 9), u = ri(0, tn - 1), S = tn + u, D = tn - u;
  return { q: 'จำนวนสองหลักจำนวนหนึ่ง ผลบวกของเลขโดดสองหลักเป็น ' + S + ' ผลต่างของเลขโดดเป็น ' + D + ' และหลักสิบมีค่ามากกว่าหลักหน่วย จำนวนนี้คือเท่าไร', ans: tn * 10 + u, explain: 'หลักสิบ = (' + S + ' + ' + D + ') ÷ 2 = ' + tn + ' หลักหน่วย = (' + S + ' − ' + D + ') ÷ 2 = ' + u };
});
T('A19', 'analytic', 'logic', 1, 4, function (t) {
  var x = ri(3, 8 + 3 * t), y = ri(3, 8 + 3 * t), p = pick(PEOPLE), tp = {}; tp[x + y] = 'นับ' + p + 'ซ้ำสองครั้ง';
  return { q: p + 'ยืนอยู่ในแถว นับจากหัวแถวเป็นคนที่ ' + x + ' นับจากท้ายแถวเป็นคนที่ ' + y + ' แถวนี้มีกี่คน', ans: x + y - 1, unit: 'คน', traps: tp, explain: x + ' + ' + y + ' นับ' + p + 'ไปสองครั้ง ต้องลบออก 1' };
});
T('A20', 'analytic', 'logic', 1, 4, function (t) {
  var prs = [[2, 3], [3, 4], [4, 6], [6, 8], [5, 6], [4, 10], [6, 9], [8, 12], [3, 5]], pr = pick(prs.slice(0, 3 + 2 * t)), L = lcm(pr[0], pr[1]);
  return { q: 'ไฟสองดวงเริ่มกะพริบพร้อมกัน ดวงแรกกะพริบทุก ' + pr[0] + ' วินาที ดวงที่สองกะพริบทุก ' + pr[1] + ' วินาที\nอีกกี่วินาทีจึงจะกะพริบพร้อมกันอีกครั้ง', ans: L, unit: 'วินาที', explain: 'หาจำนวนที่เล็กที่สุดที่ทั้ง ' + pr[0] + ' และ ' + pr[1] + ' หารลงตัว (ค.ร.น.) = ' + L };
});
T('A21', 'analytic', 'logic', 1, 4, function (t) {
  var k1 = ri(2, 6), k2 = ri(2, 6), p1 = ri(4, 9) + t, p2 = retry(function () { return ri(4, 10) + t; }, function (x) { return x !== p1; });
  var ch = ['ร้าน ก ถูกกว่า', 'ร้าน ข ถูกกว่า', 'ราคาต่อชิ้นเท่ากัน'], ans = p1 < p2 ? '1' : '2';
  return { type: 'choice', q: 'ร้าน ก ขายขนม ' + k1 + ' ชิ้น ราคา ' + (k1 * p1) + ' บาท\nร้าน ข ขายขนมชนิดเดียวกัน ' + k2 + ' ชิ้น ราคา ' + (k2 * p2) + ' บาท\nร้านไหนขายถูกกว่า (เทียบราคาต่อชิ้น)', choices: ch, ans: ans, explain: 'ร้าน ก ชิ้นละ ' + p1 + ' บาท ร้าน ข ชิ้นละ ' + p2 + ' บาท' };
});

/* ---------------- นับ / จัดกลุ่ม ---------------- */
T('A09', 'analytic', 'count', 1, 4, function (t) {
  var n = ri(4, 5 + t + 1);
  return { q: 'นักเรียน ' + n + ' คนจับมือทักทายกันให้ครบทุกคู่ (คู่ละ 1 ครั้ง) จะมีการจับมือทั้งหมดกี่ครั้ง', ans: n * (n - 1) / 2, unit: 'ครั้ง', explain: 'แต่ละคนจับมือกับอีก ' + (n - 1) + ' คน = ' + n + ' × ' + (n - 1) + ' แต่นับซ้ำสองเท่า จึงหารสอง' };
});
T('A10', 'analytic', 'count', 1, 4, function (t) {
  var d = ri(2, 6), m = ri(4, 6 + 2 * t), L = d * m, v = t <= 2 ? 0 : ri(1, 2), q, ans, ex;
  if (v === 0) { q = 'ปลูกต้นไม้ตลอดแนวถนนยาว ' + L + ' เมตร ต้นละห่างกัน ' + d + ' เมตร ปลูกต้นแรกที่จุดเริ่มต้นและต้นสุดท้ายที่ปลายถนน ใช้ต้นไม้กี่ต้น'; ans = m + 1; ex = 'ช่วงห่าง ' + m + ' ช่วง ต้นไม้ต้องมีมากกว่าจำนวนช่วง 1 ต้น'; }
  else if (v === 1) { q = 'ปลูกต้นไม้ตลอดแนวถนนยาว ' + L + ' เมตร ต้นละห่างกัน ' + d + ' เมตร ปลูกที่จุดเริ่มต้น แต่ไม่ปลูกที่ปลายถนน ใช้ต้นไม้กี่ต้น'; ans = m; ex = 'ปลูกด้านเดียว จำนวนต้นเท่ากับจำนวนช่วง ' + m; }
  else { q = 'ปลูกต้นไม้รอบสระน้ำรูปวงกลม เส้นรอบวงยาว ' + L + ' เมตร ต้นละห่างกัน ' + d + ' เมตร ใช้ต้นไม้กี่ต้น'; ans = m; ex = 'รอบวงกลมไม่มีจุดเริ่มต้นและปลายสุด จำนวนต้นเท่ากับจำนวนช่วง'; }
  var tp = {}; tp[m] = 'นับจุดปลายไม่ถูก'; if (v) tp[m + 1] = 'นับจุดปลายไม่ถูก';
  return { q: q, ans: ans, unit: 'ต้น', traps: tp, explain: ex };
});
T('A11', 'analytic', 'count', 1, 4, function (t) {
  var s = ri(2, 4 + t), p = ri(2, 4), sh = t >= 3 ? ri(2, 3) : 1;
  return { q: 'ต้นมีเสื้อ ' + s + ' ตัว กางเกง ' + p + ' ตัว' + (sh > 1 ? ' รองเท้า ' + sh + ' คู่' : '') + ' ถ้าแต่งตัวโดยเลือกอย่างละ 1 ชิ้น จะแต่งตัวได้ต่างกันกี่แบบ', ans: s * p * sh, unit: 'แบบ', explain: 'เสื้อแต่ละตัวจับคู่ได้กับกางเกงทุกตัว: ' + s + ' × ' + p + (sh > 1 ? ' × ' + sh : '') };
});
T('A14', 'analytic', 'count', 1, 4, function (t) {
  var n = [2, 3, 3, 4][t - 1], ans = 0, parts = [];
  for (var k = 1; k <= n; k++) { ans += k * k; parts.push(k * k); }
  return { q: 'ตารางสี่เหลี่ยมจัตุรัสขนาด ' + n + ' × ' + n + ' ช่อง มีรูปสี่เหลี่ยมจัตุรัสทั้งหมดกี่รูป (นับทุกขนาด รวมทั้งรูปใหญ่ที่ประกอบจากหลายช่อง)', ans: ans, unit: 'รูป', explain: 'นับตามขนาด: ' + parts.join(' + ') + ' = ' + ans };
});
T('A15', 'analytic', 'count', 1, 4, function (t) {
  var dn = t === 1 ? [10, 5, 1] : [50, 20, 10, 5, 1], amt = ri(31, t === 1 ? 79 : 199), left = amt, cnt = 0;
  dn.forEach(function (d) { cnt += Math.floor(left / d); left %= d; });
  return { q: 'ต้องจ่ายเงิน ' + amt + ' บาท โดยมีธนบัตรและเหรียญ ' + dn.join(', ') + ' บาท (มีอย่างละหลายใบ) ถ้าต้องการใช้จำนวนชิ้นน้อยที่สุด ต้องใช้กี่ชิ้น', ans: cnt, unit: 'ชิ้น', explain: 'เริ่มจากชนิดที่มีค่ามากที่สุดก่อน แล้วค่อยลงมาชนิดที่น้อยลง' };
});
T('A22', 'analytic', 'count', 1, 4, function (t) {
  var i = ri(0, 6), n = [ri(8, 20), ri(10, 40), ri(20, 60), ri(30, 100)][t - 1], ans = TH_DAYS[(i + n) % 7];
  var wrongs = [1, 2, 3, 4, 5, 6].map(function (k) { return TH_DAYS[(i + n + k) % 7]; }), ch = mkChoices(ans, wrongs, 4);
  return { type: 'choice', q: 'วันนี้เป็นวัน' + TH_DAYS[i] + ' อีก ' + n + ' วันข้างหน้าจะเป็นวันอะไร', choices: ch.choices, ans: ch.ans, explain: '1 สัปดาห์มี 7 วัน ' + n + ' ÷ 7 ได้ ' + Math.floor(n / 7) + ' เศษ ' + (n % 7) + ' นับต่อจากวัน' + TH_DAYS[i] + ' ไปอีก ' + (n % 7) + ' วัน' };
});
