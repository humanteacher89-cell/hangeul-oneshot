/**
 * 한글원샷 — 구글 앱스 스크립트(시트에 붙는 작은 서버)
 *
 * 설치(휴먼쌤이 한 번):
 *  1. 구글시트를 만들고 확장 프로그램 → Apps Script → 이 파일 내용을 붙여 넣고 저장.
 *  2. 함수 setup 을 한 번 실행(탭 '자료'·'주제'·'교사'·'설정'이 없으면 머리글과 함께 만든다. 권한 허용 창이 뜬다).
 *     내 드라이브에 '한글원샷 자료' 폴더도 만든다(교사가 올린 파일을 모으는 곳). 드라이브 권한 허용 창이 함께 뜬다.
 *  3. 배포 → 새 배포 → 유형 '웹 앱' → 실행 사용자 '나' → 액세스 권한 '모든 사용자' → 배포 → 나온 주소(…/exec)를
 *     페이지의 config.js API_URL에 넣는다. 코드를 고치면 '배포 관리'에서 새 버전으로 다시 배포해야 반영된다.
 *  4. 교사는 페이지에서 직접 가입한다(2026-10-24): '설정' 탭 join_code(가입 코드, setup이 처음 한 번 만든다)를 아는 사람만
 *     이름·학교를 넣고 가입 → 이 스크립트가 로그인 코드 8자리를 만들어 '교사' 탭에 한 줄 적고 화면에 보여 준다.
 *     가입 코드가 새면 join_code 값만 바꾸고, 가입을 닫으려면 값을 비운다. 휴먼쌤이 '교사' 탭에 직접 적어도 된다(비활성은 활성 칸에 N).
 *     학교 칸은 올리기 화면에서 처음 골라져 있을 학교일 뿐이다(교사가 올릴 때 config.js SCHOOLS 16곳 중에서 고른다).
 *  5. 견본 자료가 남아 있으면 함수 cleanSamples 를 한 번 실행한다('자료' 탭 올린이 '견본' 줄과 '견본' 안내를 지움).
 *  6. 대량 올리기(2026-10-24): 함수 importAll 을 실행하면 드라이브 '한글원샷 올리기\<주제>\<하·중·상>\'의 PDF·사진과
 *     시트 '올리기' 탭의 링크 줄을 한꺼번에 '자료' 탭에 올린다(처음 실행하면 폴더와 탭을 만든다). 자세히는 importAll 위 주석.
 *
 * 하는 일: GET ?action=data → 자료·주제·설정 JSON(공개 N 제외, join_code는 빼고). POST {action:'join', joinCode, name, school, agree} → 가입.
 * POST {action:'login'|'upload'|'hide'|'fav', code, ...} → 교사 코드 확인 뒤 처리(login은 즐겨찾기 목록도, fav {id, on}은 담기·빼기). 틀린 코드·가입 코드가 10분에 30번 넘으면 10분 막는다.
 * 파일 올리기(2026-10-18): upload에 file {name, type, data(base64)}가 오면 '한글원샷 자료' 폴더에 저장하고 '링크가 있는 모든 사용자 보기'로 연 뒤
 * 그 링크를 '자료' 탭 링크 칸에 적는다. 파일 주인은 휴먼쌤(이 스크립트 실행 사용자)이라 교사가 자기 드라이브에서 지워도 남는다.
 * 숨기기는 줄의 공개 칸만 N으로 바꾸고 파일은 지우지 않는다(보관).
 * 시트는 아무와도 공유하지 않는다(스크립트가 '나'로 실행되어 읽고 쓴다). 교사·학습자는 페이지만 본다.
 */

var SHEETS = {
  자료: ['id', '묶음', '주제', '레벨', '제목', '유형', '링크', '설명', '시간', '학교', '올린이', '올린날짜', '공개'],
  주제: ['주제', '프랑스어', '묶음', '순서', '아이콘'],
  교사: ['이름', '학교', '코드', '활성', '가입일', '즐겨찾기'],   // 즐겨찾기 = 자료 id를 쉼표로(최근에 담은 것이 앞, 2026-10-24)
  설정: ['키', '값'],
  올리기: ['주제', '레벨', '제목', '링크', '유형', '설명', '확인']
};
// '주제' 탭의 아이콘 칸: 이모지 하나(예: 👨‍👩‍👧) 또는 글자. 비우면 페이지가 주제 이름으로 고른다.
// 파일 올리기 한도·형식(index.html의 FILE_MAX_MB·FILE_EXT와 같게). 폴더 이름은 처음 만들 때만 쓰고, 그 뒤로는 폴더 id로 찾는다(이름을 바꿔도 됨).
var FILE_MAX_MB = 10;
var FILE_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];   // PDF·사진만, 영상은 링크로(휴먼쌤 2026-10-24)
var FOLDER_NAME = '한글원샷 자료';
var KEYS = { 자료: ['id', 'group', 'topic', 'level', 'title', 'type', 'url', 'desc', 'minutes', 'school', 'by', 'date', 'pub'], 주제: ['topic', 'fr', 'group', 'order', 'icon'] };
// 틀린 코드·가입 코드 막기: 앱스 스크립트는 기기를 가릴 수 없어 모든 시도를 함께 센다(10분에 30번 넘으면 10분 동안 'too_many').
var FAIL_LIMIT = 30, FAIL_WINDOW = 600;

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); }
    if (sh.getLastRow() === 0) { sh.appendRow(SHEETS[name]); sh.setFrozenRows(1); }
    // 머리글이 모자라면(예: '가입일' 칸이 생기기 전에 만든 시트) 빈 칸만 채운다
    var head = sh.getRange(1, 1, 1, SHEETS[name].length).getValues()[0];
    SHEETS[name].forEach(function (h, i) { if (String(head[i]).trim() === '') sh.getRange(1, i + 1).setValue(h); });
  });
  // 교사 코드 칸은 글자로 둔다(숫자로 두면 0123이 123으로 바뀌어 로그인이 안 된다).
  ss.getSheetByName('교사').getRange('C:C').setNumberFormat('@');
  var st = ss.getSheetByName('설정');
  if (st.getLastRow() < 2) { st.appendRow(['title', '한글원샷']); st.appendRow(['subtitle', '프랑스 한글학교 레벨별 자료']); st.appendRow(['notice', '']); }
  // 가입 코드: 줄이 없을 때만 무작위로 하나 만든다(값을 비워 두면 가입이 닫힌 것이라 다시 만들지 않는다)
  if (!rows('설정', ['key', 'value']).some(function (r) { return String(r.key).trim() === 'join_code'; })) st.appendRow(['join_code', newJoinCode()]);
  folder();   // 파일 보관 폴더를 미리 만든다(드라이브 권한도 여기서 허용)
}

function newJoinCode() {
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';   // 헷갈리는 0·O·1·I는 뺐다
  for (var i = 0; i < 6; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
  return s;
}

// 견본 걷어 내기(휴먼쌤이 Apps Script 편집기에서 한 번 실행): '자료' 탭 올린이 '견본' 줄을 지우고, '설정' notice에 '견본'이 있으면 비운다.
function cleanSamples() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('자료'), n = 0;
  var by = sh.getLastRow() > 1 ? sh.getRange(2, 11, sh.getLastRow() - 1, 1).getValues() : [];
  for (var i = by.length - 1; i >= 0; i--) { if (String(by[i][0]).trim() === '견본') { sh.deleteRow(i + 2); n++; } }
  var st = ss.getSheetByName('설정'), kv = st.getLastRow() > 1 ? st.getRange(2, 1, st.getLastRow() - 1, 2).getValues() : [];
  for (var j = 0; j < kv.length; j++) { if (String(kv[j][0]).trim() === 'notice' && String(kv[j][1]).indexOf('견본') >= 0) st.getRange(j + 2, 2).setValue(''); }
  Logger.log('견본 ' + n + '줄을 지웠어요');
}

// 교사가 올린 파일을 모으는 폴더. 폴더 id를 스크립트 속성에 적어 두고 찾는다(지워졌으면 새로 만든다).
function folder() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('FOLDER_ID');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (ex) {} }
  var made = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', made.getId());
  return made;
}

// 파일 하나 저장 → 링크. 실패하면 오류 이름(file_big·file_type)을 던진다.
function saveFile(f, m, tc) {
  var raw = String(f.name || 'file').replace(/[\\/:*?"<>|]/g, '_');
  var ext = (raw.match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase();
  if (FILE_EXT.indexOf(ext) < 0) throw new Error('file_type');
  var name = raw.slice(0, raw.length - ext.length - 1).slice(0, 100) + '.' + ext;   // 긴 이름은 줄이되 확장자는 남긴다
  var bytes = Utilities.base64Decode(String(f.data || ''));
  if (!bytes.length) throw new Error('file_empty');
  if (bytes.length > FILE_MAX_MB * 1048576) throw new Error('file_big');
  var day = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
  var file = folder().createFile(Utilities.newBlob(bytes, f.type || 'application/octet-stream', day + ' ' + name));
  file.setDescription([m.topic, m.level, m.title, String(m.school || tc.school || ''), tc.name].join(' · '));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function rows(name, keys) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, keys.length).getValues();
  return v.map(function (r) { var o = {}; keys.forEach(function (k, i) { o[k] = r[i] instanceof Date ? Utilities.formatDate(r[i], 'Europe/Paris', 'yyyy-MM-dd') : r[i]; }); return o; })
          .filter(function (o) { return Object.keys(o).some(function (k) { return String(o[k]).trim() !== ''; }); });
}

function settings() {
  var o = {}; rows('설정', ['key', 'value']).forEach(function (r) { if (r.key) o[String(r.key).trim()] = String(r.value); }); return o;
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'data';
  if (action !== 'data') return json({ ok: false, error: 'unknown' });
  var mats = rows('자료', KEYS.자료).filter(function (m) { return String(m.pub).trim().toUpperCase() !== 'N'; });
  var st = settings(); delete st.join_code;   // 가입 코드는 공개 자료에 싣지 않는다
  return json({ ok: true, settings: st, topics: rows('주제', KEYS.주제), materials: mats, updatedAt: new Date().toISOString() });
}

function tooMany() { return Number(CacheService.getScriptCache().get('fails') || 0) >= FAIL_LIMIT; }
function addFail() { var c = CacheService.getScriptCache(); c.put('fails', String(Number(c.get('fails') || 0) + 1), FAIL_WINDOW); }

// 가입: 가입 코드가 맞으면 로그인 코드 8자리를 만들어 '교사' 탭에 적는다. 이름은 겹치지 않게 받는다(내 자료·숨기기가 이름으로 주인을 가린다).
function join(b) {
  var open = String(settings().join_code || '').trim();
  if (!open) return json({ ok: false, error: 'join_closed' });
  var norm = function (s) { return String(s || '').replace(/\s+/g, '').toUpperCase(); };
  if (norm(b.joinCode) !== norm(open)) { addFail(); return json({ ok: false, error: 'bad_join' }); }
  var name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 20), school = String(b.school || '').trim().slice(0, 60);
  if (!name || !school) return json({ ok: false, error: 'missing' });
  if (b.agree !== true) return json({ ok: false, error: 'need_agree' });
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var ts = rows('교사', ['name', 'school', 'code', 'active']);
    var key = function (s) { return String(s).replace(/\s+/g, '').toLowerCase(); };
    if (ts.some(function (r) { return key(r.name) === key(name); })) return json({ ok: false, error: 'dup_name' });
    var used = {}; ts.forEach(function (r) { used[String(r.code).trim()] = true; });
    var code; do { code = String(10000000 + Math.floor(Math.random() * 90000000)); } while (used[code]);
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('교사');
    sh.appendRow([name, school, '', '', Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd')]);
    sh.getRange(sh.getLastRow(), 3).setNumberFormat('@').setValue(code);
    return json({ ok: true, teacher: { name: name, school: school }, code: code });
  } finally { lock.releaseLock(); }
}

// 교사 찾기: 이름·학교와 함께 시트 줄 번호·즐겨찾기 목록도 돌려준다(즐겨찾기를 그 줄에 다시 적으려고).
function findTeacher(code) {
  code = String(code || '').trim(); if (!code) return null;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('교사'); if (!sh || sh.getLastRow() < 2) return null;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][2]).trim() === code && String(v[i][3]).trim().toUpperCase() !== 'N')
      return { name: String(v[i][0]).trim(), school: String(v[i][1]).trim(), row: i + 2, favs: favList(v[i][5]) };
  }
  return null;
}
function favList(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }

function doPost(e) {
  var b; try { b = JSON.parse(e.postData.contents); } catch (ex) { return json({ ok: false, error: 'bad_json' }); }
  if (tooMany()) return json({ ok: false, error: 'too_many' });
  if (b.action === 'join') return join(b);
  var tc = findTeacher(b.code);
  if (!tc) { addFail(); return json({ ok: false, error: 'bad_code' }); }
  if (b.action === 'login') return json({ ok: true, teacher: { name: tc.name, school: tc.school }, favs: tc.favs });

  // 즐겨찾기 담기·빼기(휴먼쌤 2026-10-24 "어디서든 로그인하면 보일 수는 없는거야?" → '교사' 탭 그 교사 줄 '즐겨찾기' 칸에 적는다)
  if (b.action === 'fav') {
    var fid = String(b.id || '').trim(); if (!fid || fid.length > 40 || fid.indexOf(',') >= 0) return json({ ok: false, error: 'missing' });
    var fl = LockService.getScriptLock(); fl.waitLock(10000);
    try {
      var me = findTeacher(b.code); if (!me) return json({ ok: false, error: 'bad_code' });
      var list = me.favs.filter(function (x) { return x !== fid; });
      if (b.on) list.unshift(fid);   // 최근에 담은 것이 앞
      list = list.slice(0, 500);
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName('교사').getRange(me.row, 6).setNumberFormat('@').setValue(list.join(','));
      return json({ ok: true, favs: list });
    } finally { fl.releaseLock(); }
  }

  // 파일은 시트 잠금 전에 드라이브에 저장한다(느린 일이라 다른 교사의 올리기를 막지 않게)
  if (b.action === 'upload' && b.file) {
    var mf = b.material || {};
    if (!mf.title || !mf.topic || !mf.level) return json({ ok: false, error: 'missing' });
    try { mf.url = saveFile(b.file, mf, tc); } catch (ex) { return json({ ok: false, error: /^file_/.test(ex.message) ? ex.message : 'file_save' }); }
    b.material = mf;
  }

  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('자료');
    if (b.action === 'upload') {
      var m = b.material || {};
      if (!m.title || !m.topic || !m.level || !/^https?:\/\//i.test(String(m.url || ''))) return json({ ok: false, error: 'missing' });
      var id = 'm' + Date.now().toString(36);
      sh.appendRow([id, m.group || '', m.topic, m.level, String(m.title).slice(0, 60), m.type || '', m.url, String(m.desc || '').slice(0, 80),
        Number(m.minutes) || '', String(m.school || tc.school || '').slice(0, 60), tc.name, Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd'), '']);
      return json({ ok: true, id: id });
    }
    if (b.action === 'hide') {
      var v = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 13).getValues();
      for (var i = 0; i < v.length; i++) {
        if (String(v[i][0]) === String(b.id)) {
          if (String(v[i][10]).trim() !== tc.name) return json({ ok: false, error: 'not_owner' });  // 자기가 올린 것만 숨긴다
          sh.getRange(i + 2, 13).setValue('N'); return json({ ok: true });
        }
      }
      return json({ ok: false, error: 'not_found' });
    }
    return json({ ok: false, error: 'unknown' });
  } finally { lock.releaseLock(); }
}

// 대량 올리기(휴먼쌤 2026-10-24 "우선은 내가 당장 한번에 올리고 싶어서 2번이 좋을거 같아" · "링크 형식은 드라이브에 안 들어가잖아").
// 편집기에서 importAll 을 실행하면(올린이·학교 = '교사' 탭 첫 줄):
//  1) 파일: 내 드라이브 '한글원샷 올리기' → <주제> 폴더 → 하·중·상 폴더 안의 PDF·사진을 자료로 올리고 '한글원샷 자료' 폴더로 옮긴다.
//     제목 = 파일 이름, 유형 = PDF '활동지'·사진 '기타'. 처음 실행하면 '주제' 탭 주제마다 폴더와 하·중·상 폴더를 만든다.
//     새 주제는 같은 자리에 폴더를 직접 만들면 된다(묶음은 '주제' 탭에 있으면 그 묶음, 없으면 '기타').
//  2) 링크: 시트 '올리기' 탭 한 줄(주제·레벨·제목·링크, 유형·설명은 골라서)을 자료로 옮기고 그 줄을 지운다.
//     유형을 비우면 유튜브·비메오는 '영상', 그 밖은 '기타'. 틀린 줄은 남기고 '확인' 칸에 까닭을 적는다.
//  3) 링크 글 파일(휴먼쌤 "그냥 복잡하게 하지말고 이대화창에다가 링크 주면 그걸 너가 대신넣어주면안되니"): '한글원샷 올리기' 바로 아래
//     .txt 한 줄 = 주제 | 레벨 | 제목 | 링크 (| 유형 | 설명). 대화로 받은 링크를 창이 드라이브에 이 파일로 적는다.
//     다 올리면 파일을 휴지통으로, 틀린 줄이 있으면 그 줄만 남기고 끝에 '← 까닭'을 붙인다.
//  5분이 넘으면 멈춘다. 다시 실행하면 남은 것부터 한다(올린 파일은 옮기고 올린 줄은 지우니 겹치지 않는다).
var IMPORT_FOLDER_NAME = '한글원샷 올리기', LEVELS = ['하', '중', '상'], IMPORT_LIMIT_MS = 300000;

function importAll() {
  var t0 = Date.now(), seq = 0, more = false, nf = 0, nl = 0, skipped = [];
  var late = function () { if (!more && Date.now() - t0 > IMPORT_LIMIT_MS) more = true; return more; };
  var groups = {}; rows('주제', KEYS.주제).forEach(function (t) { groups[String(t.topic).trim()] = String(t.group).trim(); });
  var me = rows('교사', ['name', 'school'])[0] || { name: '휴먼쌤', school: '' };
  var by = String(me.name).trim(), school = String(me.school).trim(), day = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('자료');
  var add = function (topic, level, title, type, url, desc) {
    var lock = LockService.getScriptLock(); lock.waitLock(10000);
    try { sh.appendRow(['m' + (t0 + seq++).toString(36), groups[topic] || '기타', topic, level, String(title).slice(0, 60), type, url, String(desc || '').slice(0, 80), '', school, by, day, '']); }
    finally { lock.releaseLock(); }
  };
  // 이름순으로 늘어놓되, order가 있으면 그 순서가 먼저(주제는 '주제' 탭 순서, 레벨은 하·중·상). 휴지통에 있는 것은 뺀다
  var list = function (it, order) {
    var a = []; while (it.hasNext()) { var x = it.next(); if (!x.isTrashed()) a.push(x); }
    var rank = function (x) { var i = order ? order.indexOf(x.getName().trim()) : -1; return i < 0 ? 1e9 : i; };
    return a.sort(function (x, y) { return rank(x) - rank(y) || (x.getName() < y.getName() ? -1 : x.getName() > y.getName() ? 1 : 0); });
  };

  // 링크 한 줄([주제, 레벨, 제목, 링크, 유형, 설명]) → 틀리면 까닭, 올리면 ''
  var addLink = function (r) {
    var topic = String(r[0] || '').trim(), level = String(r[1] || '').trim(), title = String(r[2] || '').trim(), url = String(r[3] || '').trim();
    var why = !topic ? '주제를 넣어 주세요' : LEVELS.indexOf(level) < 0 ? '레벨은 하·중·상' : !title ? '제목을 넣어 주세요' : !/^https?:\/\//i.test(url) ? '링크는 https://로 시작' : '';
    if (why) return why;
    var type = String(r[4] || '').trim() || (/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(url) ? '영상' : '기타');
    add(topic, level, title, type, url, String(r[5] || '').trim());
    nl++;
    return '';
  };

  // 1) 파일
  var inbox = importFolder(Object.keys(groups)), store = folder(), linkFiles = [];
  list(inbox.getFiles()).forEach(function (f) { if (/\.txt$/i.test(f.getName())) linkFiles.push(f); else skipped.push(f.getName() + ' (주제 → 하·중·상 폴더 안에)'); });
  list(inbox.getFolders(), Object.keys(groups)).forEach(function (tf) {
    var topic = tf.getName().trim();
    list(tf.getFiles()).forEach(function (f) { skipped.push(topic + '/' + f.getName() + ' (하·중·상 폴더 안에)'); });
    list(tf.getFolders(), LEVELS).forEach(function (lf) {
      var level = lf.getName().trim();
      if (LEVELS.indexOf(level) < 0) { skipped.push(topic + '/' + level + ' (레벨 폴더 이름은 하·중·상)'); return; }
      list(lf.getFiles()).forEach(function (f) {
        if (late()) return;
        var raw = f.getName(), ext = (raw.match(/\.([a-z0-9]+)$/i) || ['', ''])[1].toLowerCase();
        if (FILE_EXT.indexOf(ext) < 0) { skipped.push(topic + '/' + level + '/' + raw + ' (PDF·사진만)'); return; }
        var title = raw.slice(0, raw.length - ext.length - 1).trim();
        f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        add(topic, level, title, ext === 'pdf' ? '활동지' : '기타', f.getUrl(), '');   // 유형 5가지(앱·활동지·영상·퀴즈·기타, 휴먼쌤 2026-10-24·25)
        f.setName(day + ' ' + raw); f.setDescription([topic, level, title, school, by].join(' · ')); f.moveTo(store);
        nf++;
      });
    });
  });

  // 2) 링크: 올린 줄은 빼고 남은 줄(틀린 줄·못 한 줄)만 다시 적는다(행 삭제는 마지막 줄에서 막힐 수 있어 쓰지 않음)
  var ish = importSheet(), n = Math.max(ish.getLastRow() - 1, 0), v = n ? ish.getRange(2, 1, n, 7).getValues() : [], keep = [];
  v.forEach(function (r, i) {
    if (r.slice(0, 4).every(function (x) { return String(x).trim() === ''; })) return;
    if (late()) { keep.push(r); return; }
    var why = addLink(r);
    if (why) { r[6] = why; keep.push(r); skipped.push('올리기 ' + (i + 2) + '행 (' + why + ')'); }
  });
  if (n) { ish.getRange(2, 1, n, 7).clearContent(); if (keep.length) ish.getRange(2, 1, keep.length, 7).setValues(keep); }

  // 3) 링크 글 파일
  linkFiles.forEach(function (f) {
    var rest = [];
    f.getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '').split(/\r?\n/).forEach(function (line, i) {
      var s = line.replace(/\s*←.*$/, '').trim(); if (!s) return;
      if (late()) { rest.push(s); return; }
      var why = addLink(s.split('|'));
      if (why) { rest.push(s + '  ← ' + why); skipped.push(f.getName() + ' ' + (i + 1) + '줄 (' + why + ')'); }
    });
    if (rest.length) f.setContent(rest.join('\n') + '\n'); else f.setTrashed(true);
  });

  var msg = '파일 ' + nf + '개·링크 ' + nl + '개를 자료로 올렸어요.' + (more ? ' 5분이 넘어 멈췄어요. 한 번 더 실행하면 이어서 해요.' : '') +
    (skipped.length ? ' 건너뜀 ' + skipped.length + '개: ' + skipped.join(', ') : '');
  Logger.log(msg);
  return msg;
}

// 대량 올리기 폴더. 없으면 만들고(id는 스크립트 속성), '주제' 탭 주제마다 하·중·상 폴더를 채워 둔다(있는 폴더는 그대로).
function importFolder(topics) {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('IMPORT_FOLDER_ID'), f = null;
  if (id) { try { f = DriveApp.getFolderById(id); if (f.isTrashed()) f = null; } catch (ex) { f = null; } }
  if (!f) { f = DriveApp.createFolder(IMPORT_FOLDER_NAME); props.setProperty('IMPORT_FOLDER_ID', f.getId()); }
  var sub = function (p, name) { var it = p.getFoldersByName(name); return it.hasNext() ? it.next() : p.createFolder(name); };
  (topics || []).forEach(function (t) { var tf = sub(f, t); LEVELS.forEach(function (l) { sub(tf, l); }); });
  return f;
}

function importSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('올리기');
  if (!sh) sh = ss.insertSheet('올리기');
  if (sh.getLastRow() === 0) { sh.appendRow(SHEETS.올리기); sh.setFrozenRows(1); }
  return sh;
}
